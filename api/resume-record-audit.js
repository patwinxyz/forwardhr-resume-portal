import { getFirestoreDb, verifyFirebaseIdToken } from './_lib/firebaseAdmin.js';

const AUDIT_COLLECTION_NAME = 'resumeRecordAuditLogs';
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

const toSafeText = (value) =>
  String(value || '')
    .replace(/[<>"'`]/g, '')
    .trim();

const isAdminUser = (authUser) => {
  const email = String(authUser?.email || '')
    .trim()
    .toLowerCase();
  return Boolean(email) && ADMIN_EMAILS.has(email);
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const authUser = await authenticateRequest(req, res);
  if (!authUser) return;
  if (!isAdminUser(authUser)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  try {
    const db = getFirestoreDb();
    const limitRaw = Number.parseInt(String(req.query?.limit || '120'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 20), 300) : 120;
    const actionFilter = toSafeText(req.query?.action).toLowerCase();

    const snapshot = await db.collection(AUDIT_COLLECTION_NAME).orderBy('createdAt', 'desc').limit(limit).get();
    let logs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() || {}),
    }));

    if (actionFilter) {
      logs = logs.filter((log) => String(log.action || '').toLowerCase().includes(actionFilter));
    }

    return res.status(200).json({ ok: true, logs });
  } catch (error) {
    console.error('resume-record-audit API failed:', error);
    return res.status(500).json({ ok: false, message: error?.message || 'Server error' });
  }
}

