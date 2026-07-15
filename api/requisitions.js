import { getFirestoreDb, getStorageBucket, verifyFirebaseIdToken } from './_lib/firebaseAdmin.js';

// 允許較大的 request body（場地照片以 data URL 夾帶）
export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };

/**
 * 招募需求（廠商）API — 對應廠商入口 /employer 的「招募需求表」。
 *
 * 設計比照 resume-records.js：Firebase ID token 驗證、ADMIN_EMAILS 白名單、
 * 「非管理員只看/只改自己的、管理員看全部」的 ownerUid/ownerEmail scope。
 *
 * 與履歷最大的不同：
 *  - 一個廠商（登入者）可以有「多筆」招募需求；不像履歷會收斂成單一筆。
 *  - 有審核狀態 status：draft（草稿）→ submitted（已送出）→ open（招募中）→ closed（已結案）。
 *    廠商可改自己 draft/submitted 的需求；一旦被灃禾設為 open/closed 就只有管理員能改。
 *
 * Firestore 文件（collection: requisitions）：
 * {
 *   ownerUid, ownerEmail, ownerName,          // 送出的廠商（登入者）
 *   companyName, jobTitle, location, headcount,// 由 formData 反正規化，供列表/分組/搜尋用
 *   status,                                    // draft | submitted | open | closed
 *   formData: { ...招募需求表 20 欄位... },
 *   createdAt, updatedAt,
 *   lastModifiedByUid, lastModifiedByEmail, lastModifiedByName, lastModifiedAt,
 *   submittedAt, submitCount,                  // 送出時間與送出次數
 *   reviewedAt, reviewedByEmail,               // 灃禾核可（轉 open）時間與人
 * }
 */

const COLLECTION_NAME = 'requisitions';
const AUDIT_COLLECTION_NAME = 'requisitionAuditLogs';
const MAX_FORMDATA_BYTES = 900000;
const VALID_STATUSES = new Set(['draft', 'submitted', 'open', 'closed']);
const OWNER_EDITABLE_STATUSES = new Set(['draft', 'submitted']);
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 每張照片上限 8MB
const MAX_PHOTOS = 4; // 最多 4 張場地/工作照片

const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
);

const getBearerToken = (req) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
};

const parseBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      throw new Error('Invalid JSON body');
    }
  }
  return req.body;
};

const toSafeText = (value) =>
  String(value || '')
    .replace(/[<>"'`]/g, '')
    .trim();

const toSearchKeyword = (value) => toSafeText(value).toLowerCase();
const toUpdatedTimestamp = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeUid = (value) => toSafeText(value);
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const hasValidAuthIdentity = (authUser) => Boolean(normalizeUid(authUser?.uid));

const canAccessRecord = ({ authUser, isAdmin, record }) => {
  if (isAdmin) return true;
  const requesterUid = normalizeUid(authUser?.uid);
  const ownerUid = normalizeUid(record?.ownerUid);
  const requesterEmail = normalizeEmail(authUser?.email);
  const ownerEmail = normalizeEmail(record?.ownerEmail);
  const uidMatched = Boolean(requesterUid) && Boolean(ownerUid) && requesterUid === ownerUid;
  const emailMatched = Boolean(requesterEmail) && Boolean(ownerEmail) && requesterEmail === ownerEmail;
  return uidMatched || emailMatched;
};

const validateFormDataSize = (formData) => {
  const payload = JSON.stringify(formData || {});
  const byteSize = Buffer.byteLength(payload, 'utf8');
  if (byteSize > MAX_FORMDATA_BYTES) {
    throw new Error('Form data too large for storage');
  }
};

const getActorProfile = (authUser) => ({
  uid: normalizeUid(authUser?.uid),
  email: normalizeEmail(authUser?.email),
  name: toSafeText(authUser?.name || authUser?.displayName || ''),
});

const normalizeRecord = (doc) => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    ownerUid: data.ownerUid || '',
    ownerEmail: data.ownerEmail || '',
    ownerName: data.ownerName || '',
    companyName: data.companyName || '',
    jobTitle: data.jobTitle || '',
    location: data.location || '',
    headcount: data.headcount || '',
    status: VALID_STATUSES.has(data.status) ? data.status : 'draft',
    createdAt: data.createdAt || '',
    updatedAt: data.updatedAt || '',
    lastModifiedByUid: data.lastModifiedByUid || '',
    lastModifiedByEmail: data.lastModifiedByEmail || '',
    lastModifiedByName: data.lastModifiedByName || '',
    lastModifiedAt: data.lastModifiedAt || '',
    submittedAt: data.submittedAt || '',
    submitCount: Number(data.submitCount || 0),
    reviewedAt: data.reviewedAt || '',
    reviewedByEmail: data.reviewedByEmail || '',
    formData: data.formData || {},
  };
};

const writeAuditLog = async (db, event) => {
  const payload = event && typeof event === 'object' ? event : {};
  try {
    await db.collection(AUDIT_COLLECTION_NAME).add({
      ...payload,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('write requisition audit log failed:', error);
  }
};

// 由 formData 抽出反正規化欄位（供列表/分組/搜尋），值都轉為安全字串。
const deriveIndexFields = (formData) => {
  const fd = formData && typeof formData === 'object' ? formData : {};
  return {
    companyName: toSafeText(fd.unitName || fd.companyName || ''),
    jobTitle: toSafeText(fd.jobTitle || ''),
    location: toSafeText(fd.location || ''),
    headcount: toSafeText(fd.headcount || ''),
  };
};

// ---- 場地照片：存 Firebase Storage，Firestore 只留 URL（比照 resume-records） ----
const isDataUrlImage = (value) => /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(String(value || ''));
const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ''));

const parseImageDataUrl = (dataUrl) => {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!match) throw new Error('照片格式不正確');
  return { mimeType: match[1].toLowerCase(), base64Data: match[2] };
};

const imageExt = (mimeType) => {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/bmp') return 'bmp';
  return 'jpg';
};

const deleteStorageObject = async (bucket, path) => {
  const safe = toSafeText(path);
  if (!safe) return;
  try {
    await bucket.file(safe).delete({ ignoreNotFound: true });
  } catch (error) {
    // 清理失敗不影響主流程
  }
};

const uploadPhotoDataUrl = async (bucket, ownerUid, recordId, dataUrl, idx) => {
  const { mimeType, base64Data } = parseImageDataUrl(dataUrl);
  const buffer = Buffer.from(base64Data, 'base64');
  if (!buffer || buffer.length === 0) throw new Error('照片內容為空');
  if (buffer.length > MAX_PHOTO_BYTES) throw new Error('照片過大，請上傳 8MB 以下圖片');
  const fileName = `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}.${imageExt(mimeType)}`;
  const photoPath = `requisition-photos/${normalizeUid(ownerUid)}/${recordId}/${fileName}`;
  const file = bucket.file(photoPath);
  await file.save(buffer, {
    resumable: false,
    contentType: mimeType,
    metadata: { cacheControl: 'public,max-age=31536000' },
  });
  const [photoURL] = await file.getSignedUrl({ action: 'read', expires: '2500-01-01' });
  return { photoPath, photoURL };
};

// incoming：字串陣列（新圖=data URL、既有=先前存的 signed URL）→ { photos:[url], photoPaths:[path] }
const applyPhotosPersistence = async ({ incoming, existing, ownerUid, recordId }) => {
  const incomingPhotos = (Array.isArray(incoming) ? incoming : []).slice(0, MAX_PHOTOS);
  const existingPhotos = Array.isArray(existing?.photos) ? existing.photos : [];
  const existingPaths = Array.isArray(existing?.photoPaths) ? existing.photoPaths : [];
  const urlToPath = new Map();
  existingPhotos.forEach((url, i) => {
    if (url) urlToPath.set(url, existingPaths[i] || '');
  });

  const photos = [];
  const photoPaths = [];
  let bucket = null;
  for (let i = 0; i < incomingPhotos.length; i += 1) {
    const item = String(incomingPhotos[i] || '').trim();
    if (!item) continue;
    if (isDataUrlImage(item)) {
      if (!bucket) bucket = getStorageBucket();
      const uploaded = await uploadPhotoDataUrl(bucket, ownerUid, recordId, item, i);
      photos.push(uploaded.photoURL);
      photoPaths.push(uploaded.photoPath);
    } else if (isHttpUrl(item) && urlToPath.has(item)) {
      // 只允許沿用先前存過的 URL（擋任意外部網址 / SSRF）
      photos.push(item);
      photoPaths.push(urlToPath.get(item));
    }
    // 其他一律忽略
  }
  // 刪掉不再引用的舊圖
  const keep = new Set(photoPaths);
  const stale = existingPaths.filter((p) => p && !keep.has(p));
  if (stale.length) {
    if (!bucket) bucket = getStorageBucket();
    for (const p of stale) await deleteStorageObject(bucket, p);
  }
  return { photos, photoPaths };
};

const matchRecordByKeywords = (record, filters) => {
  if (filters.status && record.status !== filters.status) return false;
  if (filters.company && normalizeEmail(record.companyName) !== '' &&
      !String(record.companyName || '').toLowerCase().includes(filters.company)) {
    return false;
  }
  if (filters.q) {
    const haystack = [record.companyName, record.jobTitle, record.location]
      .map((item) => String(item || '').toLowerCase());
    if (!haystack.some((item) => item.includes(filters.q))) return false;
  }
  return true;
};

const authenticateRequest = async (req, res) => {
  const idToken = getBearerToken(req);
  if (!idToken) {
    res.status(401).json({ ok: false, message: 'Missing Firebase ID token' });
    return null;
  }

  try {
    return await verifyFirebaseIdToken(idToken);
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('Firebase Admin 未設定') || message.includes('FIREBASE_SERVICE_ACCOUNT_JSON')) {
      res.status(500).json({ ok: false, message });
      return null;
    }
    res.status(401).json({ ok: false, message: 'Invalid Firebase ID token' });
    return null;
  }
};

const isAdminUser = (authUser) => {
  const email = normalizeEmail(authUser?.email);
  return Boolean(email) && ADMIN_EMAILS.has(email);
};

// ---- GET: 列表 ----
const listRecords = async (req, res, authUser, isAdmin) => {
  if (!hasValidAuthIdentity(authUser)) {
    return res.status(401).json({ ok: false, message: 'Invalid Firebase user identity' });
  }

  const db = getFirestoreDb();
  const filters = {
    q: toSearchKeyword(req.query?.q),
    status: toSafeText(req.query?.status),
    company: toSearchKeyword(req.query?.company),
  };

  let snapshot;
  if (isAdmin) {
    snapshot = await db.collection(COLLECTION_NAME).get();
  } else {
    snapshot = await db.collection(COLLECTION_NAME).where('ownerUid', '==', authUser.uid).get();
    if (snapshot.empty && authUser.email) {
      snapshot = await db
        .collection(COLLECTION_NAME)
        .where('ownerEmail', '==', normalizeEmail(authUser.email))
        .get();
    }
  }

  const records = snapshot.docs
    .map(normalizeRecord)
    .filter((record) => {
      if (isAdmin) return true;
      const byUid = normalizeUid(record.ownerUid) === normalizeUid(authUser.uid);
      const byEmail = normalizeEmail(record.ownerEmail) === normalizeEmail(authUser.email);
      return byUid || byEmail;
    })
    .filter((record) => matchRecordByKeywords(record, filters))
    .sort((a, b) => toUpdatedTimestamp(b.updatedAt) - toUpdatedTimestamp(a.updatedAt));

  return res.status(200).json({ ok: true, records });
};

// ---- POST: 建立 / 更新 ----
const upsertRecord = async (req, res, authUser, isAdmin) => {
  const db = getFirestoreDb();
  const actor = getActorProfile(authUser);
  const body = parseBody(req);
  const incomingFormData = body?.formData;
  const recordId = toSafeText(body?.recordId);
  const shouldSubmit = body?.submit === true;

  if (!incomingFormData || typeof incomingFormData !== 'object' || Array.isArray(incomingFormData)) {
    return res.status(400).json({ ok: false, message: 'Invalid formData' });
  }

  const nowIso = new Date().toISOString();
  const indexFields = deriveIndexFields(incomingFormData);
  let docRef;
  let existingData = null;
  let operation = 'create';

  if (recordId) {
    docRef = db.collection(COLLECTION_NAME).doc(recordId);
    const snapshot = await docRef.get();
    existingData = snapshot.exists ? (snapshot.data() || {}) : null;

    if (!existingData) {
      return res.status(404).json({ ok: false, message: 'Requisition not found' });
    }
    if (!canAccessRecord({ authUser, isAdmin, record: existingData })) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    // 需求一旦被灃禾設為 open/closed，只有管理員能再編修
    if (!isAdmin && !OWNER_EDITABLE_STATUSES.has(existingData.status || 'draft')) {
      return res.status(409).json({ ok: false, message: '此需求已由灃禾處理，如需修改請與灃禾聯繫。' });
    }
    operation = 'update';
  } else {
    docRef = db.collection(COLLECTION_NAME).doc();
    operation = 'create';
  }

  const ownerUid = existingData?.ownerUid || authUser.uid;
  const ownerEmail = normalizeEmail(existingData?.ownerEmail || authUser.email);
  const ownerName = existingData?.ownerName || authUser.name || '';

  // 場地照片：data URL → 上傳 Storage；既有 URL → 沿用；被移除的 → 刪除。Firestore 只存短網址。
  let normalizedFormData;
  try {
    const { photos, photoPaths } = await applyPhotosPersistence({
      incoming: incomingFormData.photos,
      existing: existingData?.formData || {},
      ownerUid,
      recordId: docRef.id,
    });
    normalizedFormData = { ...incomingFormData, photos, photoPaths };
    validateFormDataSize(normalizedFormData);
  } catch (error) {
    return res.status(400).json({ ok: false, message: error?.message || '表單或照片處理失敗' });
  }

  // 決定狀態：預設沿用/建為 draft；submit=true 時轉 submitted 並記錄送出時間與次數
  const prevStatus = existingData?.status && VALID_STATUSES.has(existingData.status)
    ? existingData.status
    : 'draft';
  let status = prevStatus;
  let submittedAt = String(existingData?.submittedAt || '');
  let submitCount = Number(existingData?.submitCount || 0);
  if (shouldSubmit) {
    // 只有 draft/submitted 能由此送出；open/closed 維持原狀（管理員流程另走 PATCH）
    if (OWNER_EDITABLE_STATUSES.has(prevStatus)) {
      status = 'submitted';
      submittedAt = nowIso;
      submitCount = submitCount + 1;
    }
  }

  const payload = {
    ownerUid,
    ownerEmail,
    ownerName,
    ...indexFields,
    status,
    formData: normalizedFormData,
    updatedAt: nowIso,
    lastModifiedByUid: actor.uid,
    lastModifiedByEmail: actor.email,
    lastModifiedByName: actor.name,
    lastModifiedAt: nowIso,
    submittedAt,
    submitCount,
    reviewedAt: String(existingData?.reviewedAt || ''),
    reviewedByEmail: String(existingData?.reviewedByEmail || ''),
  };

  if (existingData) {
    await docRef.update(payload);
  } else {
    await docRef.set({ ...payload, createdAt: nowIso });
  }

  const saved = await docRef.get();
  await writeAuditLog(db, {
    action: shouldSubmit ? `${operation}_submit` : operation,
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorName: actor.name,
    isAdmin,
    recordId: docRef.id,
    ownerUid,
    ownerEmail,
    status,
  });
  return res.status(200).json({ ok: true, record: normalizeRecord(saved) });
};

// ---- PATCH: 管理員狀態流轉 ----
const patchRecord = async (req, res, authUser, isAdmin) => {
  const db = getFirestoreDb();
  const actor = getActorProfile(authUser);
  const body = parseBody(req);
  const recordId = toSafeText(body?.recordId || req.query?.id);
  const action = toSafeText(body?.action);

  if (!recordId) {
    return res.status(400).json({ ok: false, message: 'Missing record id' });
  }
  if (!action) {
    return res.status(400).json({ ok: false, message: 'Missing action' });
  }

  const docRef = db.collection(COLLECTION_NAME).doc(recordId);
  const snapshot = await docRef.get();
  const existing = snapshot.exists ? (snapshot.data() || {}) : null;
  if (!existing) {
    return res.status(404).json({ ok: false, message: 'Requisition not found' });
  }

  const nowIso = new Date().toISOString();

  if (action === 'setStatus') {
    // 只有管理員能核可/結案
    if (!isAdmin) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    const nextStatus = toSafeText(body?.status);
    if (!VALID_STATUSES.has(nextStatus)) {
      return res.status(400).json({ ok: false, message: `Invalid status: ${nextStatus}` });
    }

    const payload = {
      status: nextStatus,
      updatedAt: nowIso,
      lastModifiedByUid: actor.uid,
      lastModifiedByEmail: actor.email,
      lastModifiedByName: actor.name,
      lastModifiedAt: nowIso,
    };
    // 首次轉為 open 時記錄核可資訊
    if (nextStatus === 'open' && !existing.reviewedAt) {
      payload.reviewedAt = nowIso;
      payload.reviewedByEmail = actor.email;
    }

    await docRef.update(payload);
    await writeAuditLog(db, {
      action: 'set_status',
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorName: actor.name,
      isAdmin,
      recordId,
      ownerUid: normalizeUid(existing?.ownerUid),
      ownerEmail: normalizeEmail(existing?.ownerEmail),
      statusBefore: existing.status || '',
      statusAfter: nextStatus,
    });

    const saved = await docRef.get();
    return res.status(200).json({ ok: true, record: normalizeRecord(saved) });
  }

  return res.status(400).json({ ok: false, message: `Unsupported action: ${action}` });
};

// ---- DELETE ----
const deleteRecord = async (req, res, authUser, isAdmin) => {
  const db = getFirestoreDb();
  const actor = getActorProfile(authUser);
  const recordId = toSafeText(req.query?.id);
  if (!recordId) {
    return res.status(400).json({ ok: false, message: 'Missing record id' });
  }

  const docRef = db.collection(COLLECTION_NAME).doc(recordId);
  const snapshot = await docRef.get();
  const existing = snapshot.exists ? (snapshot.data() || {}) : null;
  if (!existing) {
    return res.status(404).json({ ok: false, message: 'Requisition not found' });
  }
  if (!canAccessRecord({ authUser, isAdmin, record: existing })) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  // 一併清掉 Storage 上的場地照片
  const stalePhotoPaths = Array.isArray(existing?.formData?.photoPaths) ? existing.formData.photoPaths : [];
  if (stalePhotoPaths.length) {
    try {
      const bucket = getStorageBucket();
      for (const p of stalePhotoPaths) await deleteStorageObject(bucket, p);
    } catch (error) {
      // 清理失敗不擋刪除
    }
  }

  await docRef.delete();
  await writeAuditLog(db, {
    action: 'delete',
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorName: actor.name,
    isAdmin,
    recordId,
    ownerUid: normalizeUid(existing?.ownerUid),
    ownerEmail: normalizeEmail(existing?.ownerEmail),
  });
  return res.status(200).json({ ok: true });
};

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method || '')) {
    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const authUser = await authenticateRequest(req, res);
  if (!authUser) return;
  const isAdmin = isAdminUser(authUser);

  try {
    if (req.method === 'GET') return await listRecords(req, res, authUser, isAdmin);
    if (req.method === 'POST') return await upsertRecord(req, res, authUser, isAdmin);
    if (req.method === 'PATCH') return await patchRecord(req, res, authUser, isAdmin);
    return await deleteRecord(req, res, authUser, isAdmin);
  } catch (error) {
    console.error('requisitions API failed:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Server error' });
  }
}
