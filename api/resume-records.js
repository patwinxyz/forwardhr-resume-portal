import { getFirestoreDb, getStorageBucket, verifyFirebaseIdToken } from './_lib/firebaseAdmin.js';

const COLLECTION_NAME = 'resumeRecords';
const AUDIT_COLLECTION_NAME = 'resumeRecordAuditLogs';
const MAX_FORMDATA_BYTES = 900000;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
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

const hasValidAuthIdentity = (authUser) => Boolean(normalizeUid(authUser?.uid));

const canAccessRecord = ({ authUser, isAdmin, record }) => {
  if (isAdmin) return true;
  const requesterUid = normalizeUid(authUser?.uid);
  const ownerUid = normalizeUid(record?.ownerUid);
  const requesterEmail = String(authUser?.email || '').trim().toLowerCase();
  const ownerEmail = String(record?.ownerEmail || '').trim().toLowerCase();
  const uidMatched = Boolean(requesterUid) && Boolean(ownerUid) && requesterUid === ownerUid;
  const emailMatched = Boolean(requesterEmail) && Boolean(ownerEmail) && requesterEmail === ownerEmail;
  return uidMatched || emailMatched;
};

const ensureActionPermission = ({ action, res, authUser, isAdmin, record, requestedOwnerUid = '' }) => {
  const requesterUid = normalizeUid(authUser?.uid);

  if (!requesterUid) {
    res.status(401).json({ ok: false, message: 'Invalid Firebase user identity' });
    return false;
  }

  if (action === 'create') {
    if (isAdmin) {
      res.status(403).json({ ok: false, message: '管理員僅可編修既有資料，無法新增草稿' });
      return false;
    }

    // 防止一般使用者嘗試在 payload 指定其他 owner。
    const ownerUidFromRequest = normalizeUid(requestedOwnerUid);
    if (ownerUidFromRequest && ownerUidFromRequest !== requesterUid) {
      res.status(403).json({ ok: false, message: 'Forbidden' });
      return false;
    }

    return true;
  }

  if (!record) {
    res.status(404).json({ ok: false, message: 'Record not found' });
    return false;
  }

  if (!canAccessRecord({ authUser, isAdmin, record })) {
    res.status(403).json({ ok: false, message: 'Forbidden' });
    return false;
  }

  return true;
};

const validateFormDataSize = (formData) => {
  const payload = JSON.stringify(formData || {});
  const byteSize = Buffer.byteLength(payload, 'utf8');
  if (byteSize > MAX_FORMDATA_BYTES) {
    throw new Error('Form data too large for storage');
  }
};

const normalizeRecord = (doc) => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    title: data.title || '',
    ownerUid: data.ownerUid || '',
    ownerEmail: data.ownerEmail || '',
    ownerName: data.ownerName || '',
    createdAt: data.createdAt || '',
    updatedAt: data.updatedAt || '',
    lastModifiedByUid: data.lastModifiedByUid || '',
    lastModifiedByEmail: data.lastModifiedByEmail || '',
    lastModifiedByName: data.lastModifiedByName || '',
    lastModifiedAt: data.lastModifiedAt || '',
    emailRepliedAt: data.emailRepliedAt || '',
    emailRepliedByEmail: data.emailRepliedByEmail || '',
    phoneRepliedAt: data.phoneRepliedAt || '',
    phoneRepliedByEmail: data.phoneRepliedByEmail || '',
    completedAt: data.completedAt || '',
    completedByEmail: data.completedByEmail || '',
    submitCount: Number(data.submitCount || 0),
    lastSubmittedAt: data.lastSubmittedAt || '',
    formData: data.formData || {},
  };
};

const getActorProfile = (authUser) => ({
  uid: normalizeUid(authUser?.uid),
  email: String(authUser?.email || '').trim().toLowerCase(),
  name: toSafeText(authUser?.name || authUser?.displayName || ''),
});

const writeAuditLog = async (db, event) => {
  const payload = event && typeof event === 'object' ? event : {};
  try {
    await db.collection(AUDIT_COLLECTION_NAME).add({
      ...payload,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('write audit log failed:', error);
  }
};

const pickLatestDocFromSnapshot = (snapshot) => {
  if (!snapshot || snapshot.empty) return null;

  let latestDoc = null;
  let latestTime = -1;

  snapshot.forEach((doc) => {
    const raw = doc.data() || {};
    const updatedAt = toUpdatedTimestamp(raw.updatedAt);
    const createdAt = toUpdatedTimestamp(raw.createdAt);
    const score = Math.max(updatedAt, createdAt);
    if (score > latestTime) {
      latestDoc = doc;
      latestTime = score;
    }
  });

  return latestDoc;
};

const findLatestRecordByOwner = async (db, ownerUid, ownerEmail) => {
  const safeUid = normalizeUid(ownerUid);
  const safeEmail = String(ownerEmail || '').trim().toLowerCase();

  if (safeUid) {
    const uidSnapshot = await db.collection(COLLECTION_NAME).where('ownerUid', '==', safeUid).get();
    const uidLatestDoc = pickLatestDocFromSnapshot(uidSnapshot);
    if (uidLatestDoc) {
      return {
        docRef: uidLatestDoc.ref,
        data: uidLatestDoc.data() || {},
      };
    }
  }

  if (!safeEmail) return null;
  const emailSnapshot = await db.collection(COLLECTION_NAME).where('ownerEmail', '==', safeEmail).get();
  const emailLatestDoc = pickLatestDocFromSnapshot(emailSnapshot);
  const latestDoc = emailLatestDoc;
  if (!latestDoc) return null;

  return {
    docRef: latestDoc.ref,
    data: latestDoc.data() || {},
  };
};

const isDataUrlImage = (value) => /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(String(value || ''));

const parseImageDataUrl = (dataUrl) => {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!match) throw new Error('Invalid image data URL');
  return {
    mimeType: match[1].toLowerCase(),
    base64Data: match[2],
  };
};

const getImageExtensionFromMime = (mimeType) => {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/bmp') return 'bmp';
  return 'jpg';
};

const deleteStorageObject = async (bucket, photoPath) => {
  const safePath = toSafeText(photoPath);
  if (!safePath) return;
  try {
    await bucket.file(safePath).delete({ ignoreNotFound: true });
  } catch (error) {
    // keep record operation running if old photo cleanup fails
  }
};

const uploadPhotoDataUrlToStorage = async (bucket, ownerUid, recordId, photoDataUrl) => {
  const { mimeType, base64Data } = parseImageDataUrl(photoDataUrl);
  const buffer = Buffer.from(base64Data, 'base64');

  if (!buffer || buffer.length === 0) {
    throw new Error('照片內容為空');
  }
  if (buffer.length > MAX_PHOTO_BYTES) {
    throw new Error('照片過大，請上傳 8MB 以下圖片');
  }

  const extension = getImageExtensionFromMime(mimeType);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const photoPath = `resume-photos/${ownerUid}/${recordId}/${fileName}`;
  const file = bucket.file(photoPath);

  await file.save(buffer, {
    resumable: false,
    contentType: mimeType,
    metadata: {
      cacheControl: 'public,max-age=31536000',
    },
  });

  const [photoURL] = await file.getSignedUrl({
    action: 'read',
    expires: '2500-01-01',
  });

  return {
    photoPath,
    photoURL,
  };
};

const applyPhotoPersistence = async ({
  incomingFormData,
  existingFormData,
  ownerUid,
  recordId,
}) => {
  const normalizedFormData = { ...incomingFormData };
  const incomingPhoto = String(incomingFormData?.photoDataUrl || '').trim();
  const existingPhotoPath = toSafeText(existingFormData?.photoPath);
  const existingPhotoURL = String(existingFormData?.photoURL || '').trim();

  // 新照片（data URL）：上傳 Storage，回存 photoPath/photoURL
  if (isDataUrlImage(incomingPhoto)) {
    const bucket = getStorageBucket();
    const { photoPath, photoURL } = await uploadPhotoDataUrlToStorage(bucket, ownerUid, recordId, incomingPhoto);
    if (existingPhotoPath && existingPhotoPath !== photoPath) {
      await deleteStorageObject(bucket, existingPhotoPath);
    }
    normalizedFormData.photoPath = photoPath;
    normalizedFormData.photoURL = photoURL;
    normalizedFormData.photoDataUrl = photoURL;
    normalizedFormData.photoUpdatedAt = new Date().toISOString();
    return normalizedFormData;
  }

  // 清空照片
  if (!incomingPhoto) {
    if (existingPhotoPath) {
      const bucket = getStorageBucket();
      await deleteStorageObject(bucket, existingPhotoPath);
    }
    normalizedFormData.photoPath = '';
    normalizedFormData.photoURL = '';
    normalizedFormData.photoDataUrl = '';
    normalizedFormData.photoUpdatedAt = '';
    return normalizedFormData;
  }

  // 已存在的 URL（例如載入歷史後儲存）
  if (/^https?:\/\//i.test(incomingPhoto)) {
    normalizedFormData.photoPath = existingPhotoPath;
    normalizedFormData.photoURL = incomingPhoto;
    normalizedFormData.photoDataUrl = incomingPhoto;
    normalizedFormData.photoUpdatedAt =
      incomingPhoto === existingPhotoURL
        ? String(existingFormData?.photoUpdatedAt || '')
        : new Date().toISOString();
    return normalizedFormData;
  }

  // 其他格式直接沿用舊值，避免誤覆蓋
  normalizedFormData.photoPath = existingPhotoPath;
  normalizedFormData.photoURL = existingPhotoURL;
  normalizedFormData.photoDataUrl = existingPhotoURL;
  normalizedFormData.photoUpdatedAt = String(existingFormData?.photoUpdatedAt || '');
  return normalizedFormData;
};

const matchRecordByKeywords = (record, filters) => {
  const formData = record?.formData || {};
  const candidateName = String(formData.name || '').toLowerCase();
  const candidateArc = String(formData.arcNumber || '').toLowerCase();
  const candidatePhone = String(formData.phone || '').toLowerCase();

  if (filters.q) {
    const hit = [candidateName, candidateArc, candidatePhone].some((candidate) => candidate.includes(filters.q));
    if (!hit) return false;
  }

  if (filters.name && !candidateName.includes(filters.name)) return false;
  if (filters.arcNumber && !candidateArc.includes(filters.arcNumber)) return false;
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
  const email = String(authUser?.email || '')
    .trim()
    .toLowerCase();
  return Boolean(email) && ADMIN_EMAILS.has(email);
};

const listRecords = async (req, res, authUser, isAdmin) => {
  if (!hasValidAuthIdentity(authUser)) {
    return res.status(401).json({ ok: false, message: 'Invalid Firebase user identity' });
  }

  const db = getFirestoreDb();
  const filters = {
    q: toSearchKeyword(req.query?.q),
    name: toSearchKeyword(req.query?.name),
    arcNumber: toSearchKeyword(req.query?.arcNumber),
  };

  let snapshot;
  if (isAdmin) {
    snapshot = await db.collection(COLLECTION_NAME).get();
  } else {
    snapshot = await db.collection(COLLECTION_NAME).where('ownerUid', '==', authUser.uid).get();
    if (snapshot.empty && authUser.email) {
      snapshot = await db
        .collection(COLLECTION_NAME)
        .where('ownerEmail', '==', String(authUser.email || '').trim().toLowerCase())
        .get();
    }
  }

  const records = snapshot.docs
    .map(normalizeRecord)
    .filter((record) => {
      if (isAdmin) return true;
      const byUid = normalizeUid(record.ownerUid) === normalizeUid(authUser.uid);
      const byEmail =
        String(record.ownerEmail || '').trim().toLowerCase() === String(authUser.email || '').trim().toLowerCase();
      return byUid || byEmail;
    })
    .filter((record) => matchRecordByKeywords(record, filters))
    .sort((a, b) => toUpdatedTimestamp(b.updatedAt) - toUpdatedTimestamp(a.updatedAt));

  if (!isAdmin) {
    const latestOnly = records[0] ? [records[0]] : [];
    return res.status(200).json({ ok: true, records: latestOnly });
  }

  return res.status(200).json({ ok: true, records });
};

const upsertRecord = async (req, res, authUser, isAdmin) => {
  const db = getFirestoreDb();
  const actor = getActorProfile(authUser);
  const body = parseBody(req);
  const incomingFormData = body?.formData;
  const recordId = toSafeText(body?.recordId);
  const title = toSafeText(body?.title) || '未命名草稿';
  const requestedOwnerUid = normalizeUid(body?.ownerUid);

  if (!incomingFormData || typeof incomingFormData !== 'object' || Array.isArray(incomingFormData)) {
    return res.status(400).json({ ok: false, message: 'Invalid formData' });
  }

  if (!isAdmin && requestedOwnerUid && requestedOwnerUid !== actor.uid) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const nowIso = new Date().toISOString();
  let docRef;
  let existingData = null;
  let operation = 'create';

  if (recordId) {
    docRef = db.collection(COLLECTION_NAME).doc(recordId);
    const snapshot = await docRef.get();
    existingData = snapshot.exists ? (snapshot.data() || {}) : null;

    // 統一權限檢核（更新既有資料）
    if (!ensureActionPermission({ action: 'update', res, authUser, isAdmin, record: existingData })) {
      return;
    }
    operation = 'update';
  } else {
    // 一般使用者固定維持單一履歷：若已存在，改為更新最新一筆。
    if (!isAdmin) {
      const latestOwnedRecord = await findLatestRecordByOwner(db, authUser.uid, authUser.email);
      if (latestOwnedRecord) {
        docRef = latestOwnedRecord.docRef;
        existingData = latestOwnedRecord.data;
        if (!ensureActionPermission({ action: 'update', res, authUser, isAdmin, record: existingData })) {
          return;
        }
        operation = 'update';
      }
    }

    if (!docRef) {
      if (!ensureActionPermission({ action: 'create', res, authUser, isAdmin, requestedOwnerUid })) {
        return;
      }
      docRef = db.collection(COLLECTION_NAME).doc();
      operation = 'create';
    }
  }

  const ownerUid = existingData?.ownerUid || authUser.uid;
  const ownerEmail = String(existingData?.ownerEmail || authUser.email || '').trim().toLowerCase();
  const ownerName = existingData?.ownerName || authUser.name || '';

  let normalizedFormData;
  try {
    normalizedFormData = await applyPhotoPersistence({
      incomingFormData,
      existingFormData: existingData?.formData || {},
      ownerUid,
      recordId: docRef.id,
    });
    validateFormDataSize(normalizedFormData);
  } catch (error) {
    return res.status(400).json({ ok: false, message: error?.message || '照片處理失敗' });
  }

  const payload = {
    title,
    ownerUid,
    ownerEmail,
    ownerName,
    formData: normalizedFormData,
    updatedAt: nowIso,
    lastModifiedByUid: actor.uid,
    lastModifiedByEmail: actor.email,
    lastModifiedByName: actor.name,
    lastModifiedAt: nowIso,
    emailRepliedAt: String(existingData?.emailRepliedAt || ''),
    emailRepliedByEmail: String(existingData?.emailRepliedByEmail || ''),
    phoneRepliedAt: String(existingData?.phoneRepliedAt || ''),
    phoneRepliedByEmail: String(existingData?.phoneRepliedByEmail || ''),
    completedAt: String(existingData?.completedAt || ''),
    completedByEmail: String(existingData?.completedByEmail || ''),
    submitCount: Number(existingData?.submitCount || 0),
    lastSubmittedAt: String(existingData?.lastSubmittedAt || ''),
  };

  if (existingData) {
    await docRef.update(payload);
  } else {
    await docRef.set({
      ...payload,
      createdAt: nowIso,
    });
  }

  const saved = await docRef.get();
  await writeAuditLog(db, {
    action: operation,
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorName: actor.name,
    isAdmin,
    recordId: docRef.id,
    ownerUid,
    ownerEmail,
  });
  return res.status(200).json({ ok: true, record: normalizeRecord(saved) });
};

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
  if (!ensureActionPermission({ action: 'delete', res, authUser, isAdmin, record: existing })) {
    return;
  }

  const photoPath = toSafeText(existing.formData?.photoPath);
  if (photoPath) {
    try {
      const bucket = getStorageBucket();
      await deleteStorageObject(bucket, photoPath);
    } catch (error) {
      // keep delete record running
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
    ownerEmail: String(existing?.ownerEmail || '').trim().toLowerCase(),
  });
  return res.status(200).json({ ok: true });
};

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
  if (!ensureActionPermission({ action: 'update', res, authUser, isAdmin, record: existing })) {
    return;
  }

  const nowIso = new Date().toISOString();

  if (action === 'setContactStatus') {
    if (!isAdmin) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const setEmailReplied = body?.setEmailReplied === true;
    const setPhoneReplied = body?.setPhoneReplied === true;

    const nextEmailRepliedAt = setEmailReplied ? (existing.emailRepliedAt || nowIso) : '';
    const nextPhoneRepliedAt = setPhoneReplied ? (existing.phoneRepliedAt || nowIso) : '';
    const nextEmailRepliedByEmail = setEmailReplied ? (existing.emailRepliedByEmail || actor.email) : '';
    const nextPhoneRepliedByEmail = setPhoneReplied ? (existing.phoneRepliedByEmail || actor.email) : '';
    const isCompleted = Boolean(nextEmailRepliedAt) && Boolean(nextPhoneRepliedAt);

    const payload = {
      emailRepliedAt: nextEmailRepliedAt,
      emailRepliedByEmail: nextEmailRepliedByEmail,
      phoneRepliedAt: nextPhoneRepliedAt,
      phoneRepliedByEmail: nextPhoneRepliedByEmail,
      completedAt: isCompleted ? (existing.completedAt || nowIso) : '',
      completedByEmail: isCompleted ? (existing.completedByEmail || actor.email) : '',
      updatedAt: nowIso,
      lastModifiedByUid: actor.uid,
      lastModifiedByEmail: actor.email,
      lastModifiedByName: actor.name,
      lastModifiedAt: nowIso,
    };

    await docRef.update(payload);
    await writeAuditLog(db, {
      action: 'set_contact_status',
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorName: actor.name,
      isAdmin,
      recordId,
      ownerUid: normalizeUid(existing?.ownerUid),
      ownerEmail: String(existing?.ownerEmail || '').trim().toLowerCase(),
      setEmailReplied,
      setPhoneReplied,
      completed: isCompleted,
    });

    const saved = await docRef.get();
    return res.status(200).json({ ok: true, record: normalizeRecord(saved) });
  }

  if (action === 'markSubmitted') {
    const currentSubmitCount = Number(existing.submitCount || 0);
    const payload = {
      submitCount: currentSubmitCount + 1,
      lastSubmittedAt: nowIso,
      updatedAt: nowIso,
    };
    await docRef.update(payload);
    await writeAuditLog(db, {
      action: 'mark_submitted',
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorName: actor.name,
      isAdmin,
      recordId,
      ownerUid: normalizeUid(existing?.ownerUid),
      ownerEmail: String(existing?.ownerEmail || '').trim().toLowerCase(),
      submitCountBefore: currentSubmitCount,
      submitCountAfter: currentSubmitCount + 1,
    });

    const saved = await docRef.get();
    return res.status(200).json({ ok: true, record: normalizeRecord(saved) });
  }

  return res.status(400).json({ ok: false, message: `Unsupported action: ${action}` });
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
    console.error('resume-records API failed:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Server error' });
  }
}
