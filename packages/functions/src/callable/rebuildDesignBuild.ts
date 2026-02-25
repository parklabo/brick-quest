import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const rebuildDesignBuild = onCall({ maxInstances: 10, region: 'asia-northeast1' }, async (request) => {
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

  if (data.type !== 'design') {
    throw new HttpsError('failed-precondition', 'Only design jobs can be rebuilt');
  }

  if (data.status !== 'completed') {
    throw new HttpsError('failed-precondition', `Job is not completed (current: ${data.status})`);
  }

  if (!data.views?.composite) {
    throw new HttpsError('failed-precondition', 'No views available for rebuild');
  }

  // Clear previous result and transition to generating_build
  // This triggers processDesignUpdate (before.status !== 'generating_build' && after.status === 'generating_build')
  await jobRef.update({
    status: 'generating_build',
    result: FieldValue.delete(),
    error: FieldValue.delete(),
    usedFallbackModel: FieldValue.delete(),
    progress: 45,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});
