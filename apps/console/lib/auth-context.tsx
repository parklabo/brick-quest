'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth } from './firebase';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdTokenResult();
        setIsAdmin(token.claims.admin === true);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    let cred;
    try {
      cred = await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/user-not-found') {
        cred = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        throw err;
      }
    }
    let token = await cred.user.getIdTokenResult();

    if (token.claims.admin !== true) {
      // Attempt to claim admin role via Cloud Function
      try {
        const functions = getFunctions(auth.app);
        if (process.env.NODE_ENV === 'development') {
          connectFunctionsEmulator(functions, 'localhost', 7021);
        }
        await httpsCallable(functions, 'setAdminRole')();
        // Force token refresh to pick up new claims
        token = await cred.user.getIdTokenResult(true);
      } catch {
        // Claim failed — not an authorized admin
      }

      if (token.claims.admin !== true) {
        await firebaseSignOut(auth);
        throw new Error('This account does not have admin access.');
      }
    }
  };

  const signOut = () => firebaseSignOut(auth);

  return (
    <AuthContext value={{ user, isAdmin, loading, signIn, signOut }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
