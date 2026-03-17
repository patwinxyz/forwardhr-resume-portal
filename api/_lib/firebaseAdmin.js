import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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

const getFirebaseAuth = () => {
  const existingApp = getApps()[0];
  if (existingApp) return getAuth(existingApp);

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    throw new Error(
      'Firebase Admin 未設定。請提供 FIREBASE_SERVICE_ACCOUNT_JSON 或 FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY。'
    );
  }

  const app = initializeApp({
    credential: cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    }),
  });

  return getAuth(app);
};

const verifyFirebaseIdToken = async (idToken) => {
  const auth = getFirebaseAuth();
  return auth.verifyIdToken(idToken);
};

export { verifyFirebaseIdToken };
