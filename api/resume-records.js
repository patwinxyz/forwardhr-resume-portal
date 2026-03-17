import { getFirestoreDb, getStorageBucket, verifyFirebaseIdToken } from './_lib/firebaseAdmin.js';

const COLLECTION_NAME = 'resumeRecords';
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
  return Boolean(requesterUid) && Boolean(ownerUid) && requesterUid === ownerUid;
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
    formData: data.formData || {},
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

  const query = isAdmin
    ? db.collection(COLLECTION_NAME)
    : db.collection(COLLECTION_NAME).where('ownerUid', '==', authUser.uid);
  const snapshot = await query.get();

  const records = snapshot.docs
    .map(normalizeRecord)
    .filter((record) => (isAdmin ? true : record.ownerUid === authUser.uid))
    .filter((record) => matchRecordByKeywords(record, filters))
    .sort((a, b) => toUpdatedTimestamp(b.updatedAt) - toUpdatedTimestamp(a.updatedAt));

  return res.status(200).json({ ok: true, records });
};

const upsertRecord = async (req, res, authUser, isAdmin) => {
  const db = getFirestoreDb();
  const body = parseBody(req);
  const incomingFormData = body?.formData;
  const recordId = toSafeText(body?.recordId);
  const title = toSafeText(body?.title) || '未命名草稿';
  const requestedOwnerUid = normalizeUid(body?.ownerUid);

  if (!incomingFormData || typeof incomingFormData !== 'object' || Array.isArray(incomingFormData)) {
    return res.status(400).json({ ok: false, message: 'Invalid formData' });
  }

  // 統一權限檢核（建立新資料）
  if (!recordId && !ensureActionPermission({ action: 'create', res, authUser, isAdmin, requestedOwnerUid })) {
    return;
  }

  const nowIso = new Date().toISOString();
  let docRef;
  let existingData = null;

  if (recordId) {
    docRef = db.collection(COLLECTION_NAME).doc(recordId);
    const snapshot = await docRef.get();
    existingData = snapshot.exists ? (snapshot.data() || {}) : null;

    // 統一權限檢核（更新既有資料）
    if (!ensureActionPermission({ action: 'update', res, authUser, isAdmin, record: existingData })) {
      return;
    }
  } else {
    docRef = db.collection(COLLECTION_NAME).doc();
  }

  const ownerUid = existingData?.ownerUid || authUser.uid;
  const ownerEmail = existingData?.ownerEmail || authUser.email || '';
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
  return res.status(200).json({ ok: true, record: normalizeRecord(saved) });
};

const deleteRecord = async (req, res, authUser, isAdmin) => {
  const db = getFirestoreDb();
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
  return res.status(200).json({ ok: true });
};

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const authUser = await authenticateRequest(req, res);
  if (!authUser) return;
  const isAdmin = isAdminUser(authUser);

  try {
    if (req.method === 'GET') return await listRecords(req, res, authUser, isAdmin);
    if (req.method === 'POST') return await upsertRecord(req, res, authUser, isAdmin);
    return await deleteRecord(req, res, authUser, isAdmin);
  } catch (error) {
    console.error('resume-records API failed:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Server error' });
  }
}
