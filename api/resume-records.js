import { getFirestoreDb, verifyFirebaseIdToken } from './_lib/firebaseAdmin.js';

const COLLECTION_NAME = 'resumeRecords';
const MAX_FORMDATA_BYTES = 900000;
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

const matchRecordByKeywords = (record, nameKeyword, arcKeyword) => {
  if (!nameKeyword && !arcKeyword) return true;
  const formData = record?.formData || {};
  const candidateName = String(formData.name || '').toLowerCase();
  const candidateArc = String(formData.arcNumber || '').toLowerCase();
  if (nameKeyword && !candidateName.includes(nameKeyword)) return false;
  if (arcKeyword && !candidateArc.includes(arcKeyword)) return false;
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
  const db = getFirestoreDb();
  const nameKeyword = toSearchKeyword(req.query?.name);
  const arcKeyword = toSearchKeyword(req.query?.arcNumber);
  const query = isAdmin
    ? db.collection(COLLECTION_NAME)
    : db.collection(COLLECTION_NAME).where('ownerUid', '==', authUser.uid);
  const snapshot = await query.get();

  const records = snapshot.docs
    .map(normalizeRecord)
    .filter((record) => matchRecordByKeywords(record, nameKeyword, arcKeyword))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  return res.status(200).json({ ok: true, records });
};

const upsertRecord = async (req, res, authUser, isAdmin) => {
  const db = getFirestoreDb();
  const body = parseBody(req);
  const formData = body?.formData;
  const recordId = toSafeText(body?.recordId);
  const title = toSafeText(body?.title) || '未命名草稿';

  if (!formData || typeof formData !== 'object' || Array.isArray(formData)) {
    return res.status(400).json({ ok: false, message: 'Invalid formData' });
  }

  try {
    validateFormDataSize(formData);
  } catch (error) {
    return res.status(413).json({ ok: false, message: error.message });
  }

  const nowIso = new Date().toISOString();
  const payload = {
    title,
    ownerUid: authUser.uid,
    ownerEmail: authUser.email || '',
    ownerName: authUser.name || '',
    formData,
    updatedAt: nowIso,
  };

  let docRef;
  if (recordId) {
    docRef = db.collection(COLLECTION_NAME).doc(recordId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return res.status(404).json({ ok: false, message: 'Record not found' });
    }
    const existing = snapshot.data() || {};
    if (!isAdmin && existing.ownerUid !== authUser.uid) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }
    await docRef.update(
      isAdmin
        ? payload
        : {
            ...payload,
            ownerUid: authUser.uid,
            ownerEmail: authUser.email || '',
            ownerName: authUser.name || '',
          },
    );
  } else {
    if (isAdmin) {
      return res.status(403).json({ ok: false, message: '管理員僅可編修既有資料，無法新增草稿' });
    }
    docRef = db.collection(COLLECTION_NAME).doc();
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
  if (!snapshot.exists) {
    return res.status(404).json({ ok: false, message: 'Record not found' });
  }

  const existing = snapshot.data() || {};
  if (!isAdmin && existing.ownerUid !== authUser.uid) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
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
