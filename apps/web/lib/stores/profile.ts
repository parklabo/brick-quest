import { create } from 'zustand';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '../firebase';
import type { UserProfile } from '@brick-quest/shared';

interface ProfileStore {
  profile: UserProfile | null;
  loading: boolean;
  updateProfile: (data: Partial<Pick<UserProfile, 'displayName' | 'photoURL'>>) => Promise<void>;
  _initProfileSync: (uid: string, email: string | null) => () => void;
}

let currentUid: string | null = null;

export const useProfileStore = create<ProfileStore>()((set, _get) => ({
  profile: null,
  loading: true,

  updateProfile: async (data) => {
    if (!currentUid) return;
    const ref = doc(firestore, 'users', currentUid);
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  },

  _initProfileSync: (uid: string, email: string | null) => {
    currentUid = uid;
    set({ loading: true });

    const ref = doc(firestore, 'users', uid);
    const unsubscribe = onSnapshot(
      ref,
      async (snapshot) => {
        if (!snapshot.exists()) {
          // First login — create profile automatically
          const defaultName = email?.split('@')[0] ?? 'Builder';
          await setDoc(ref, {
            displayName: defaultName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return; // onSnapshot will fire again with the new doc
        }
        const data = snapshot.data();
        set({
          profile: {
            displayName: data.displayName ?? '',
            photoURL: data.photoURL,
            createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          },
          loading: false,
        });
      },
      (err) => {
        console.error('Profile sync error:', err);
        set({ loading: false });
      },
    );

    return () => {
      unsubscribe();
      currentUid = null;
      set({ profile: null, loading: true });
    };
  },
}));
