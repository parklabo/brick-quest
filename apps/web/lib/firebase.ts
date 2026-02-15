import { initializeApp, getApps } from 'firebase/app';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp(firebaseConfig);
}

// Lazy-init: only runs on client side (avoids prerender crash when env vars are missing)
let _functions: ReturnType<typeof getFunctions> | undefined;
let _firestore: ReturnType<typeof getFirestore> | undefined;
let _auth: ReturnType<typeof getAuth> | undefined;
let _storage: ReturnType<typeof getStorage> | undefined;

function initServices() {
  if (_functions) return;
  const app = getApp();
  _functions = getFunctions(app);
  _firestore = getFirestore(app);
  _auth = getAuth(app);
  _storage = getStorage(app);

  if (process.env.NODE_ENV === 'development') {
    connectFunctionsEmulator(_functions, 'localhost', 7021);
    connectFirestoreEmulator(_firestore, 'localhost', 7022);
    connectStorageEmulator(_storage, 'localhost', 7023);
    if (!_auth.emulatorConfig) {
      connectAuthEmulator(_auth, 'http://localhost:7024', { disableWarnings: true });
    }
  }
}

export const functions = new Proxy({} as ReturnType<typeof getFunctions>, { get: (_, prop) => { initServices(); return (_functions as any)[prop]; } });
export const firestore = new Proxy({} as ReturnType<typeof getFirestore>, { get: (_, prop) => { initServices(); return (_firestore as any)[prop]; } });
export const auth = new Proxy({} as ReturnType<typeof getAuth>, { get: (_, prop) => { initServices(); return (_auth as any)[prop]; } });
export const storage = new Proxy({} as ReturnType<typeof getStorage>, { get: (_, prop) => { initServices(); return (_storage as any)[prop]; } });
