import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const approveDesignViews = onCall(
  { maxInstances: 10 },
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

    if (data.status !== 'views_ready') {
      throw new HttpsError('failed-precondition', `Job is not in views_ready state (current: ${data.status})`);
    }

    // Transition to generating_build — this triggers processDesignBuild
    await jobRef.update({
      status: 'generating_build',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  },
);
