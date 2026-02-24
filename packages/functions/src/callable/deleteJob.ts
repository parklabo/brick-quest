import { logger } from 'firebase-functions';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { config } from '../config.js';

const DELETABLE = new Set(['failed', 'completed']);

/** Known storage paths per job type */
const STORAGE_PATHS: Record<string, (jobId: string) => string[]> = {
  scan: (id) => [`scans/${id}/image.jpeg`],
  design: (id) => [`designs/${id}/reference.jpeg`, `designs/${id}/composite.png`],
};

export const deleteJob = onCall(
  { maxInstances: 10, region: 'asia-northeast1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { jobId } = request.data as { jobId: string };
    if (!jobId || typeof jobId !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing jobId');
    }

    const db = getFirestore();
    const jobRef = db.collection('jobs').doc(jobId);
    const snapshot = await jobRef.get();

    if (!snapshot.exists) {
      throw new HttpsError('not-found', 'Job not found');
    }

    const data = snapshot.data()!;

    if (data.userId !== uid) {
      throw new HttpsError('permission-denied', 'Not your job');
    }

    if (!DELETABLE.has(data.status)) {
      throw new HttpsError(
        'failed-precondition',
        `Job cannot be deleted (current: ${data.status})`,
      );
    }

    // Delete known storage files individually (compatible with emulator)
    const bucket = getStorage().bucket(config.firebase.storageBucket || undefined);
    const pathsFn = STORAGE_PATHS[data.type];

    if (pathsFn) {
      const paths = pathsFn(jobId);
      await Promise.all(
        paths.map((p) =>
          bucket.file(p).delete().catch((err) => {
            logger.warn(`Failed to delete ${p}: ${err}`);
          }),
        ),
      );
    }

    // Delete Firestore document
    await jobRef.delete();

    return { success: true };
  },
);
