import { create } from 'zustand';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type Timestamp,
} from 'firebase/firestore';
import { firestore } from '../firebase';
import type { JobType, JobStatus, DesignViews } from '@brick-quest/shared';

const ADDED_IDS_KEY = 'brick-quest-added-job-ids';

function loadAddedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(ADDED_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveAddedIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADDED_IDS_KEY, JSON.stringify([...ids]));
}

export interface TrackedJob {
  id: string;
  type: JobType;
  status: JobStatus;
  result?: unknown;
  error?: string;
  views?: DesignViews;
  createdAt: number; // epoch ms
  seen: boolean;
  addedToInventory: boolean;
}

interface JobsStore {
  jobs: TrackedJob[];
  addJob: (id: string, type: JobType) => void;
  markSeen: (id: string) => void;
  markAddedToInventory: (id: string) => void;
  unmarkAddedToInventory: (id: string) => void;
  _initJobsListener: (uid: string) => () => void;
}

const addedIds = loadAddedIds();

export const useJobsStore = create<JobsStore>()((set, get) => ({
  jobs: [],

  addJob: (id, type) => {
    set((s) => {
      if (s.jobs.some((j) => j.id === id)) return s;
      return {
        jobs: [
          { id, type, status: 'pending', createdAt: Date.now(), seen: false, addedToInventory: false },
          ...s.jobs,
        ],
      };
    });
  },

  markSeen: (id) => {
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, seen: true } : j)),
    }));
  },

  markAddedToInventory: (id) => {
    addedIds.add(id);
    saveAddedIds(addedIds);
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, addedToInventory: true } : j)),
    }));
  },

  unmarkAddedToInventory: (id) => {
    addedIds.delete(id);
    saveAddedIds(addedIds);
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, addedToInventory: false } : j)),
    }));
  },

  _initJobsListener: (uid: string) => {
    const q = query(
      collection(firestore, 'jobs'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const current = get().jobs;
      const updated = [...current];

      for (const change of snapshot.docChanges()) {
        const data = change.doc.data();
        const id = change.doc.id;
        const createdAt =
          data.createdAt instanceof Object && 'toMillis' in data.createdAt
            ? (data.createdAt as Timestamp).toMillis()
            : Date.now();

        const idx = updated.findIndex((j) => j.id === id);

        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            status: data.status,
            result: data.result,
            error: data.error,
            views: data.views,
          };
        } else {
          const needsAttention = data.status === 'completed' || data.status === 'failed' || data.status === 'views_ready';
          updated.push({
            id,
            type: data.type,
            status: data.status,
            result: data.result,
            error: data.error,
            views: data.views,
            createdAt,
            seen: needsAttention ? false : true,
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
  s.jobs.filter((j) => j.type === 'design' && !j.seen && (j.status === 'completed' || j.status === 'failed' || j.status === 'views_ready')).length;

export const selectPendingJobs = (s: { jobs: TrackedJob[] }) =>
  s.jobs.filter((j) => j.status === 'pending' || j.status === 'processing' || j.status === 'generating_views' || j.status === 'generating_build');
