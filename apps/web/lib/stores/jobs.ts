import { create } from 'zustand';
import { collection, query, where, orderBy, onSnapshot, type Timestamp } from 'firebase/firestore';
import { firestore } from '../firebase';
import type { JobType, JobStatus, DesignViews } from '@brick-quest/shared';

const SEEN_IDS_KEY = 'brick-quest-seen-job-ids';
const ADDED_IDS_KEY = 'brick-quest-added-job-ids';

function loadIdSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveIdSet(key: string, ids: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify([...ids]));
}

export interface TrackedJob {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  logs: string[];
  result?: unknown;
  error?: string;
  views?: DesignViews;
  usedFallbackModel?: boolean;
  createdAt: number; // epoch ms
  seen: boolean;
  addedToInventory: boolean;
}

interface JobsStore {
  jobs: TrackedJob[];
  selectedDesignJobId: string | null;
  addJob: (id: string, type: JobType) => void;
  removeJob: (id: string) => void;
  markSeen: (id: string) => void;
  markAddedToInventory: (id: string) => void;
  unmarkAddedToInventory: (id: string) => void;
  selectDesignJob: (id: string) => void;
  clearDesignJob: () => void;
  _initJobsListener: (uid: string) => () => void;
}

const seenIds = loadIdSet(SEEN_IDS_KEY);
const addedIds = loadIdSet(ADDED_IDS_KEY);

export const useJobsStore = create<JobsStore>()((set, get) => ({
  jobs: [],
  selectedDesignJobId: null,

  addJob: (id, type) => {
    set((s) => {
      if (s.jobs.some((j) => j.id === id)) return s;
      return {
        jobs: [{ id, type, status: 'pending', progress: 0, logs: [], createdAt: Date.now(), seen: false, addedToInventory: false }, ...s.jobs],
      };
    });
  },

  removeJob: (id) => {
    seenIds.delete(id);
    saveIdSet(SEEN_IDS_KEY, seenIds);
    addedIds.delete(id);
    saveIdSet(ADDED_IDS_KEY, addedIds);
    set((s) => ({
      jobs: s.jobs.filter((j) => j.id !== id),
    }));
  },

  markSeen: (id) => {
    seenIds.add(id);
    saveIdSet(SEEN_IDS_KEY, seenIds);
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, seen: true } : j)),
    }));
  },

  markAddedToInventory: (id) => {
    addedIds.add(id);
    saveIdSet(ADDED_IDS_KEY, addedIds);
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, addedToInventory: true } : j)),
    }));
  },

  unmarkAddedToInventory: (id) => {
    addedIds.delete(id);
    saveIdSet(ADDED_IDS_KEY, addedIds);
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, addedToInventory: false } : j)),
    }));
  },

  selectDesignJob: (id) => set({ selectedDesignJobId: id }),
  clearDesignJob: () => set({ selectedDesignJobId: null }),

  _initJobsListener: (uid: string) => {
    const q = query(collection(firestore, 'jobs'), where('userId', '==', uid), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const current = get().jobs;
      const updated = [...current];

      for (const change of snapshot.docChanges()) {
        const id = change.doc.id;

        if (change.type === 'removed') {
          const removeIdx = updated.findIndex((j) => j.id === id);
          if (removeIdx >= 0) updated.splice(removeIdx, 1);
          continue;
        }

        const data = change.doc.data();
        const createdAt =
          data.createdAt instanceof Object && 'toMillis' in data.createdAt ? (data.createdAt as Timestamp).toMillis() : Date.now();

        const idx = updated.findIndex((j) => j.id === id);

        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            status: data.status,
            progress: data.progress ?? updated[idx].progress,
            logs: data.logs ?? updated[idx].logs,
            result: data.result,
            error: data.error,
            views: data.views,
            usedFallbackModel: data.usedFallbackModel,
          };
        } else {
          const needsAttention = data.status === 'completed' || data.status === 'failed' || data.status === 'views_ready';
          updated.push({
            id,
            type: data.type,
            status: data.status,
            progress: data.progress ?? 0,
            logs: data.logs ?? [],
            result: data.result,
            error: data.error,
            views: data.views,
            usedFallbackModel: data.usedFallbackModel,
            createdAt,
            seen: seenIds.has(id) || !needsAttention,
            addedToInventory: addedIds.has(id),
          });
        }
      }

      updated.sort((a, b) => b.createdAt - a.createdAt);
      set({ jobs: updated });
    });

    return unsubscribe;
  },
}));

// Selectors
export const selectUnseenScanCount = (s: { jobs: TrackedJob[] }) =>
  s.jobs.filter((j) => j.type === 'scan' && !j.seen && (j.status === 'completed' || j.status === 'failed')).length;

export const selectUnseenBuildCount = (s: { jobs: TrackedJob[] }) =>
  s.jobs.filter((j) => j.type === 'build' && !j.seen && (j.status === 'completed' || j.status === 'failed')).length;

export const selectUnseenDesignCount = (s: { jobs: TrackedJob[] }) =>
  s.jobs.filter((j) => j.type === 'design' && !j.seen && (j.status === 'completed' || j.status === 'failed' || j.status === 'views_ready'))
    .length;

/** Combined selector — 3→1 subscription for NavBar */
export const selectUnseenCounts = (s: { jobs: TrackedJob[] }) => {
  let scan = 0,
    build = 0,
    design = 0;
  for (const j of s.jobs) {
    if (j.seen) continue;
    const done = j.status === 'completed' || j.status === 'failed';
    if (j.type === 'scan' && done) scan++;
    else if (j.type === 'build' && done) build++;
    else if (j.type === 'design' && (done || j.status === 'views_ready')) design++;
  }
  return { scan, build, design };
};

export const selectPendingJobs = (s: { jobs: TrackedJob[] }) =>
  s.jobs.filter(
    (j) => j.status === 'pending' || j.status === 'processing' || j.status === 'generating_views' || j.status === 'generating_build'
  );
