'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '../../lib/hooks/useAuth';
import { useInventoryStore } from '../../lib/stores/inventory';
import { useJobsStore } from '../../lib/stores/jobs';
import { useProfileStore } from '../../lib/stores/profile';
import { useToastStore } from '../../lib/stores/toasts';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, uid } = useAuth();
  const prevJobsRef = useRef<Map<string, string>>(new Map());

  // Init Firestore sync for profile, inventory & jobs
  useEffect(() => {
    if (!uid) return;
    const unsubProfile = useProfileStore.getState()._initProfileSync(uid, user?.email ?? null);
    const unsubInventory = useInventoryStore.getState()._initFirestoreSync(uid);
    const unsubJobs = useJobsStore.getState()._initJobsListener(uid);
    return () => {
      unsubProfile();
      unsubInventory();
      unsubJobs();
    };
  }, [uid, user?.email]);

  // Toast on job completion
  useEffect(() => {
    const unsub = useJobsStore.subscribe((state) => {
      const prev = prevJobsRef.current;

      for (const job of state.jobs) {
        const prevStatus = prev.get(job.id);
        if (prevStatus && prevStatus !== job.status) {
          if (job.status === 'completed') {
            const label = job.type === 'scan' ? 'Scan' : 'Build';
            const reviewPath =
              job.type === 'scan'
                ? `/scan/${job.id}/review`
                : `/build/${job.id}/view`;
            useToastStore.getState().addToast({
              message: `${label} complete!`,
              variant: 'success',
              action: { label: 'View results', href: reviewPath },
            });
          } else if (job.status === 'failed') {
            const label = job.type === 'scan' ? 'Scan' : 'Build';
            useToastStore.getState().addToast({
              message: `${label} failed: ${job.error || 'Unknown error'}`,
              variant: 'error',
            });
          }
        }
      }

      // Update previous state
      const next = new Map<string, string>();
      for (const job of state.jobs) {
        next.set(job.id, job.status);
      }
      prevJobsRef.current = next;
    });
    return unsub;
  }, []);

  return children;
}
