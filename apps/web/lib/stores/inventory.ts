import { create } from 'zustand';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '../firebase';
import type { DetectedPart } from '@brick-quest/shared';
import { resolveShape } from '@brick-quest/shared';

const LOCALSTORAGE_KEY = 'brick-quest-inventory';
const DEBOUNCE_MS = 500;

interface InventoryStore {
  parts: DetectedPart[];
  addParts: (newParts: DetectedPart[]) => void;
  removeParts: (partsToRemove: DetectedPart[]) => void;
  removePart: (id: string) => void;
  updatePartCount: (id: string, count: number) => void;
  updatePartTags: (id: string, tags: string[]) => void;
  clearParts: () => void;
  _initFirestoreSync: (uid: string) => () => void;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentUid: string | null = null;

function scheduleWrite(parts: DetectedPart[]) {
  if (!currentUid) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  const uid = currentUid;
  debounceTimer = setTimeout(() => {
    setDoc(doc(firestore, 'inventories', uid), {
      parts,
      updatedAt: serverTimestamp(),
    }).catch(console.error);
  }, DEBOUNCE_MS);
}

function migrateFromLocalStorage(): DetectedPart[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const parts: DetectedPart[] = parsed?.state?.parts;
    if (Array.isArray(parts) && parts.length > 0) {
      localStorage.removeItem(LOCALSTORAGE_KEY);
      return parts;
    }
    localStorage.removeItem(LOCALSTORAGE_KEY);
  } catch {
    localStorage.removeItem(LOCALSTORAGE_KEY);
  }
  return null;
}

export const useInventoryStore = create<InventoryStore>()((set, get) => ({
  parts: [],

  addParts: (newParts) => {
    const existing = get().parts;
    const merged = [...existing];

    for (const newPart of newParts) {
      const match = merged.findIndex(
        (p) =>
          p.type === newPart.type &&
          p.shape === newPart.shape &&
          p.color === newPart.color &&
          p.dimensions.width === newPart.dimensions.width &&
          p.dimensions.length === newPart.dimensions.length
      );
      if (match >= 0) {
        const existingTags = merged[match].tags ?? [];
        const newTags = newPart.tags ?? [];
        const mergedTags = [...new Set([...existingTags, ...newTags])];
        merged[match] = {
          ...merged[match],
          count: merged[match].count + newPart.count,
          ...(mergedTags.length > 0 ? { tags: mergedTags } : {}),
        };
      } else {
        merged.push({
          ...newPart,
          id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        });
      }
    }
    set({ parts: merged });
    scheduleWrite(merged);
  },

  removeParts: (partsToRemove) => {
    const existing = [...get().parts];
    for (const removePart of partsToRemove) {
      const match = existing.findIndex(
        (p) =>
          p.type === removePart.type &&
          p.shape === removePart.shape &&
          p.color === removePart.color &&
          p.dimensions.width === removePart.dimensions.width &&
          p.dimensions.length === removePart.dimensions.length
      );
      if (match >= 0) {
        const newCount = existing[match].count - removePart.count;
        if (newCount <= 0) {
          existing.splice(match, 1);
        } else {
          existing[match] = { ...existing[match], count: newCount };
        }
      }
    }
    set({ parts: existing });
    scheduleWrite(existing);
  },

  removePart: (id) => {
    const parts = get().parts.filter((p) => p.id !== id);
    set({ parts });
    scheduleWrite(parts);
  },

  updatePartCount: (id, count) => {
    const parts = get().parts.map((p) => (p.id === id ? { ...p, count } : p));
    set({ parts });
    scheduleWrite(parts);
  },

  updatePartTags: (id, tags) => {
    const parts = get().parts.map((p) =>
      p.id === id ? { ...p, tags: tags.length > 0 ? tags : undefined } : p
    );
    set({ parts });
    scheduleWrite(parts);
  },

  clearParts: () => {
    set({ parts: [] });
    scheduleWrite([]);
  },

  _initFirestoreSync: (uid: string) => {
    currentUid = uid;

    // Migrate localStorage data if it exists
    const migrated = migrateFromLocalStorage();
    if (migrated) {
      set({ parts: migrated });
      scheduleWrite(migrated);
    }

    // Listen for real-time Firestore updates
    const unsubscribe = onSnapshot(
      doc(firestore, 'inventories', uid),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore DocumentData is untyped
        const remoteParts: DetectedPart[] = (data.parts ?? []).map((p: any) => ({
          ...p,
          shape: resolveShape(p.shape ?? 'rectangle', p.type),
        }));
        // Only update if remote differs (avoid echo from our own writes)
        const localParts = get().parts;
        if (JSON.stringify(localParts) !== JSON.stringify(remoteParts)) {
          set({ parts: remoteParts });
        }
      },
      console.error
    );

    return () => {
      unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
      currentUid = null;
    };
  },
}));
