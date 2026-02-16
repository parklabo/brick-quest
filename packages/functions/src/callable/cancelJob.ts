import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const CANCELLABLE: Set<string> = new Set([
  'pending',
  'processing',
  'generating_views',
  'generating_build',
]);

export const cancelJob = onCall(
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

    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(jobRef);

      if (!snapshot.exists) {
        throw new HttpsError('not-found', 'Job not found');
      }

      const data = snapshot.data()!;

      if (data.userId !== uid) {
        throw new HttpsError('permission-denied', 'Not your job');
      }

      if (!CANCELLABLE.has(data.status)) {
        throw new HttpsError(
          'failed-precondition',
          `Job cannot be cancelled (current: ${data.status})`,
        );
      }

      tx.update(jobRef, {
        status: 'failed',
        error: 'Cancelled by user',
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  },
);
