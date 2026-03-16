import { getApps, initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const firebaseReady = Object.values(firebaseConfig).every((value) => String(value || '').trim() !== '');

let auth = null;
let googleProvider = null;

if (firebaseReady) {
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

const isFirebaseAuthConfigured = () => firebaseReady;

const subscribeAuthUser = (callback) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

const loginWithGoogle = async () => {
  if (!auth || !googleProvider) {
    throw new Error('Firebase 登入尚未設定完成');
  }
  return signInWithPopup(auth, googleProvider);
};

const logoutAuthUser = async () => {
  if (!auth) return;
  await signOut(auth);
};

export {
  isFirebaseAuthConfigured,
  subscribeAuthUser,
  loginWithGoogle,
  logoutAuthUser,
};
