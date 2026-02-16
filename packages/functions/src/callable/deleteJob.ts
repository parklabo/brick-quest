import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const DELETABLE = new Set(['failed', 'completed']);

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

    // Delete storage files
    const storage = getStorage();
    const bucket = storage.bucket();

    if (data.type === 'scan') {
      await bucket.deleteFiles({ prefix: `scans/${jobId}/` }).catch(() => {/* ignore */});
    } else if (data.type === 'design') {
      await bucket.deleteFiles({ prefix: `designs/${jobId}/` }).catch(() => {/* ignore */});
    }

    // Delete Firestore document
    await jobRef.delete();

    return { success: true };
  },
);
