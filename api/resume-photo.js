import { getFirestoreDb, getStorageBucket, verifyFirebaseIdToken } from './_lib/firebaseAdmin.js';

const COLLECTION_NAME = 'resumeRecords';
const MAX_PHOTO_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
]);
const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
);

const toSafeText = (value) =>
  String(value || '')
    .replace(/[<>"'`]/g, '')
    .trim();

const normalizeUid = (value) => toSafeText(value);

const isDataUrlImage = (value) => /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(String(value || ''));

const getDataUrlPhotoInfo = (dataUrl) => {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!match) return null;
  const mimeType = String(match[1] || '').toLowerCase();
  const base64Data = String(match[2] || '');
  const paddingLength = (base64Data.match(/=+$/) || [''])[0].length;
  const byteSize = Math.floor((base64Data.length * 3) / 4) - paddingLength;
  return { mimeType, byteSize };
};

const getBearerToken = (req) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
};

const isAdminUser = (authUser) => {
  const email = String(authUser?.email || '')
    .trim()
    .toLowerCase();
  return Boolean(email) && ADMIN_EMAILS.has(email);
};

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

const getImageMimeByExtension = (pathText = '') => {
  const lower = String(pathText).toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'image/jpeg';
};

const getMimeTypeFromBuffer = (buffer, fallback = 'image/jpeg') => {
  if (!buffer || buffer.length < 12) return fallback;
  const b = buffer;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return 'image/webp';
  }
  return fallback;
};

const ensureAllowedImageMimeType = (mimeType) => {
  const normalized = String(mimeType || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(normalized)) {
    throw new Error(`不支援的圖片格式：${normalized || 'unknown'}`);
  }
  return normalized;
};

const getPhotoDataUrlFromStoragePath = async (photoPath) => {
  const bucket = getStorageBucket();
  const file = bucket.file(photoPath);
  let mimeType = getImageMimeByExtension(photoPath);
  let expectedByteSize = 0;

  try {
    const [metadata] = await file.getMetadata();
    const metadataSize = Number.parseInt(String(metadata?.size || '0'), 10);
    expectedByteSize = Number.isFinite(metadataSize) ? metadataSize : 0;
    if (expectedByteSize > MAX_PHOTO_DOWNLOAD_BYTES) {
      throw new Error('照片過大，無法匯出（超過 10MB）');
    }
    const metadataMimeType = String(metadata?.contentType || '').trim().toLowerCase();
    if (metadataMimeType.startsWith('image/')) {
      mimeType = metadataMimeType;
    }
  } catch (error) {
    if (String(error?.message || '').includes('超過 10MB')) {
      throw error;
    }
    // metadata 讀取失敗時，改用副檔名或 magic number 判斷。
  }

  const [buffer] = await file.download();
  if (!buffer || buffer.length === 0) {
    throw new Error('照片內容為空');
  }
  if (buffer.length > MAX_PHOTO_DOWNLOAD_BYTES || expectedByteSize > MAX_PHOTO_DOWNLOAD_BYTES) {
    throw new Error('照片過大，無法匯出（超過 10MB）');
  }

  mimeType = getMimeTypeFromBuffer(buffer, mimeType);
  ensureAllowedImageMimeType(mimeType);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
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

  const recordId = toSafeText(req.query?.recordId);
  if (!recordId) {
    return res.status(400).json({ ok: false, message: 'Missing recordId' });
  }

  try {
    const db = getFirestoreDb();
    const docRef = db.collection(COLLECTION_NAME).doc(recordId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return res.status(404).json({ ok: false, message: 'Record not found' });
    }

    const record = snapshot.data() || {};
    const isAdmin = isAdminUser(authUser);
    if (!canAccessRecord({ authUser, isAdmin, record })) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const formData = record.formData || {};
    const photoDataUrl = String(formData.photoDataUrl || '').trim();
    const photoPath = toSafeText(formData.photoPath);
    const photoURL = String(formData.photoURL || '').trim();

    if (isDataUrlImage(photoDataUrl)) {
      const info = getDataUrlPhotoInfo(photoDataUrl);
      if (!info) {
        return res.status(400).json({ ok: false, message: 'Photo data URL is invalid' });
      }
      ensureAllowedImageMimeType(info.mimeType);
      if (info.byteSize > MAX_PHOTO_DOWNLOAD_BYTES) {
        return res.status(413).json({ ok: false, message: '照片過大，無法匯出（超過 10MB）' });
      }
      return res.status(200).json({ ok: true, dataUrl: photoDataUrl });
    }

    if (photoPath) {
      const dataUrl = await getPhotoDataUrlFromStoragePath(photoPath);
      return res.status(200).json({ ok: true, dataUrl });
    }

    if (/^https?:\/\//i.test(photoURL)) {
      return res.status(409).json({ ok: false, message: '舊版照片連結不支援匯出，請重新上傳照片後再匯出。' });
    }

    return res.status(404).json({ ok: false, message: 'Photo not found' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error?.message || 'Server error' });
  }
}
