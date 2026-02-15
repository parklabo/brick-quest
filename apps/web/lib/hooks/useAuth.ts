'use client';

import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';

interface AuthState {
  user: User | null;
  uid: string | null;
  loading: boolean;
  error: Error | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    uid: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setState({ user, uid: user.uid, loading: false, error: null });
      } else {
        setState({ user: null, uid: null, loading: false, error: null });
      }
    });
    return unsubscribe;
  }, []);

  return state;
}

export async function loginWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, email, password);
}

export async function logout(): Promise<void> {
  await firebaseSignOut(auth);
}
