import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const normalizePrivateKey = (value) => String(value || '').replace(/\\n/g, '\n').trim();

const parseServiceAccountFromJson = () => {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawJson) return null;

  try {
    const parsed = JSON.parse(rawJson);
    return {
      projectId: parsed.project_id || '',
      clientEmail: parsed.client_email || '',
      privateKey: normalizePrivateKey(parsed.private_key),
      storageBucket: parsed.storage_bucket || '',
    };
  } catch (error) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON 格式錯誤');
  }
};

const parseServiceAccountFromEnv = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || '');
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || '';

  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey, storageBucket };
};

const getServiceAccount = () => parseServiceAccountFromJson() || parseServiceAccountFromEnv();

const getFirebaseAdminApp = () => {
  const existingApp = getApps()[0];
  if (existingApp) return existingApp;

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    throw new Error(
      'Firebase Admin 未設定。請提供 FIREBASE_SERVICE_ACCOUNT_JSON 或 FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY。'
    );
  }

  const bucketName =
    serviceAccount.storageBucket ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    (serviceAccount.projectId ? `${serviceAccount.projectId}.appspot.com` : '');

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    }),
    ...(bucketName ? { storageBucket: bucketName } : {}),
  });
};

const verifyFirebaseIdToken = async (idToken) => {
  const auth = getAuth(getFirebaseAdminApp());
  return auth.verifyIdToken(idToken);
};

const getFirestoreDb = () => getFirestore(getFirebaseAdminApp());

const getStorageBucket = () => {
  const app = getFirebaseAdminApp();
  const bucketName =
    app.options.storageBucket ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    '';

  if (!bucketName) {
    throw new Error('Firebase Storage 未設定。請提供 FIREBASE_STORAGE_BUCKET。');
  }

  return getStorage(app).bucket(bucketName);
};

export { verifyFirebaseIdToken, getFirestoreDb, getStorageBucket };
