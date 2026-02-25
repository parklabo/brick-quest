import { create } from 'zustand';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '../firebase';
import type { DetectedPart } from '@brick-quest/shared';
import { resolveShape } from '@brick-quest/shared';

const LOCALSTORAGE_KEY = 'brick-quest-inventory';
const DEMO_KEY = 'bq-demo-mode';
const DEBOUNCE_MS = 500;

/* ── Demo brick set for hackathon trial ── */
const DEMO_PARTS: DetectedPart[] = [
  {
    id: 'demo-01',
    name: '2x4 Brick',
    color: 'Red',
    hexColor: '#B40000',
    count: 4,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 2, length: 4 },
  },
  {
    id: 'demo-02',
    name: '2x2 Brick',
    color: 'Red',
    hexColor: '#B40000',
    count: 6,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 2, length: 2 },
  },
  {
    id: 'demo-03',
    name: '1x2 Brick',
    color: 'Red',
    hexColor: '#B40000',
    count: 4,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 1, length: 2 },
  },
  {
    id: 'demo-04',
    name: '2x4 Brick',
    color: 'Blue',
    hexColor: '#0055BF',
    count: 4,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 2, length: 4 },
  },
  {
    id: 'demo-05',
    name: '2x2 Brick',
    color: 'Blue',
    hexColor: '#0055BF',
    count: 4,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 2, length: 2 },
  },
  {
    id: 'demo-06',
    name: '1x4 Brick',
    color: 'Blue',
    hexColor: '#0055BF',
    count: 2,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 1, length: 4 },
  },
  {
    id: 'demo-07',
    name: '2x4 Brick',
    color: 'Yellow',
    hexColor: '#F2CD37',
    count: 4,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 2, length: 4 },
  },
  {
    id: 'demo-08',
    name: '2x2 Brick',
    color: 'Yellow',
    hexColor: '#F2CD37',
    count: 4,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 2, length: 2 },
  },
  {
    id: 'demo-09',
    name: '2x4 Brick',
    color: 'Green',
    hexColor: '#237841',
    count: 2,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 2, length: 4 },
  },
  {
    id: 'demo-10',
    name: '2x2 Brick',
    color: 'Green',
    hexColor: '#237841',
    count: 4,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 2, length: 2 },
  },
  {
    id: 'demo-11',
    name: '2x4 Brick',
    color: 'White',
    hexColor: '#FFFFFF',
    count: 4,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 2, length: 4 },
  },
  {
    id: 'demo-12',
    name: '2x2 Brick',
    color: 'White',
    hexColor: '#FFFFFF',
    count: 4,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 2, length: 2 },
  },
  {
    id: 'demo-13',
    name: '2x4 Brick',
    color: 'Black',
    hexColor: '#1B2A34',
    count: 2,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 2, length: 4 },
  },
  {
    id: 'demo-14',
    name: '1x1 Brick',
    color: 'Black',
    hexColor: '#1B2A34',
    count: 4,
    type: 'brick',
    shape: 'rectangle',
    dimensions: { width: 1, length: 1 },
  },
  {
    id: 'demo-15',
    name: '2x4 Plate',
    color: 'Red',
    hexColor: '#B40000',
    count: 2,
    type: 'plate',
    shape: 'rectangle',
    dimensions: { width: 2, length: 4 },
  },
  {
    id: 'demo-16',
    name: '2x4 Plate',
    color: 'Green',
    hexColor: '#237841',
    count: 2,
    type: 'plate',
    shape: 'rectangle',
    dimensions: { width: 2, length: 4 },
  },
  {
    id: 'demo-17',
    name: '2x2 Slope 45°',
    color: 'Red',
    hexColor: '#B40000',
    count: 2,
    type: 'slope',
    shape: 'slope_45',
    dimensions: { width: 2, length: 2 },
  },
  {
    id: 'demo-18',
    name: '2x2 Round Brick',
    color: 'Yellow',
    hexColor: '#F2CD37',
    count: 2,
    type: 'brick',
    shape: 'round',
    dimensions: { width: 2, length: 2 },
  },
  {
    id: 'demo-19',
    name: '1x2 Tile',
    color: 'White',
    hexColor: '#FFFFFF',
    count: 2,
    type: 'tile',
    shape: 'rectangle',
    dimensions: { width: 1, length: 2 },
  },
];

function getDemoEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(DEMO_KEY);
  return stored === null ? true : stored === '1';
}

interface InventoryStore {
  parts: DetectedPart[];
  demoMode: boolean;
  toggleDemo: () => void;
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
  // Never persist demo parts to Firestore
  const realParts = parts.filter((p) => !p.id.startsWith('demo-'));
  debounceTimer = setTimeout(() => {
    setDoc(doc(firestore, 'inventories', uid), {
      parts: realParts,
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
  parts: getDemoEnabled() ? DEMO_PARTS : [],
  demoMode: getDemoEnabled(),

  toggleDemo: () => {
    const next = !get().demoMode;
    if (typeof window !== 'undefined') localStorage.setItem(DEMO_KEY, next ? '1' : '0');
    if (next) {
      // Add demo parts (merge with existing real parts)
      const real = get().parts.filter((p) => !p.id.startsWith('demo-'));
      set({ demoMode: true, parts: [...real, ...DEMO_PARTS] });
    } else {
      // Remove demo parts
      const real = get().parts.filter((p) => !p.id.startsWith('demo-'));
      set({ demoMode: false, parts: real });
      scheduleWrite(real);
    }
  },

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
    const parts = get().parts.map((p) => (p.id === id ? { ...p, tags: tags.length > 0 ? tags : undefined } : p));
    set({ parts });
    scheduleWrite(parts);
  },

  clearParts: () => {
    set({ parts: [] });
    scheduleWrite([]);
  },

  _initFirestoreSync: (uid: string) => {
    currentUid = uid;

    // Reset parts on user switch (keep demo parts if demo mode is on)
    const demoOnly = get().demoMode ? DEMO_PARTS : [];
    set({ parts: demoOnly });

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
        // Append demo parts if demo mode is on
        const withDemo = get().demoMode ? [...remoteParts, ...DEMO_PARTS] : remoteParts;
        // Only update if remote differs (avoid echo from our own writes)
        const localParts = get().parts;
        if (JSON.stringify(localParts) !== JSON.stringify(withDemo)) {
          set({ parts: withDemo });
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
