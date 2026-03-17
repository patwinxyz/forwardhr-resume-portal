import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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
    };
  } catch (error) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON 格式錯誤');
  }
};

const parseServiceAccountFromEnv = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || '');

  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
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

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    }),
  });
};

const verifyFirebaseIdToken = async (idToken) => {
  const auth = getAuth(getFirebaseAdminApp());
  return auth.verifyIdToken(idToken);
};

const getFirestoreDb = () => getFirestore(getFirebaseAdminApp());

export { verifyFirebaseIdToken, getFirestoreDb };
