import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

export const retryJob = onCall(
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

    if (data.status !== 'failed') {
      throw new HttpsError(
        'failed-precondition',
        `Job cannot be retried (current: ${data.status})`,
      );
    }

    const input = data.input;
    if (!input) {
      throw new HttpsError('failed-precondition', 'Job has no input data to retry');
    }

    const storage = getStorage();
    const bucket = storage.bucket();
    const newJobRef = db.collection('jobs').doc();
    const newJobId = newJobRef.id;

    // Copy storage files for scan/design jobs
    if (data.type === 'scan' && input.imageStoragePath) {
      const newPath = `scans/${newJobId}/image.jpeg`;
      await bucket.file(input.imageStoragePath).copy(bucket.file(newPath));
      input.imageStoragePath = newPath;
    } else if (data.type === 'design' && input.imageStoragePath) {
      const newPath = `designs/${newJobId}/reference.jpeg`;
      await bucket.file(input.imageStoragePath).copy(bucket.file(newPath));
      input.imageStoragePath = newPath;
    }

    // Create new job document with same input
    await newJobRef.set({
      type: data.type,
      status: 'pending',
      userId: uid,
      input,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { jobId: newJobId };
  },
);
