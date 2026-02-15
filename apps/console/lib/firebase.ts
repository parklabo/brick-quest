import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

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
let _firestore: ReturnType<typeof getFirestore> | undefined;
let _auth: ReturnType<typeof getAuth> | undefined;

function initServices() {
  if (_firestore) return;
  const app = getApp();
  _firestore = getFirestore(app);
  _auth = getAuth(app);

  if (process.env.NODE_ENV === 'development') {
    connectFirestoreEmulator(_firestore, 'localhost', 7022);
    if (!_auth.emulatorConfig) {
      connectAuthEmulator(_auth, 'http://localhost:7024', { disableWarnings: true });
    }
  }
}

export const firestore = new Proxy({} as ReturnType<typeof getFirestore>, { get: (_, prop) => { initServices(); return (_firestore as any)[prop]; } });
export const auth = new Proxy({} as ReturnType<typeof getAuth>, { get: (_, prop) => { initServices(); return (_auth as any)[prop]; } });
