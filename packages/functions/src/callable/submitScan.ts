import { randomUUID } from 'crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

export const submitScan = onCall(
  { maxInstances: 10, region: 'asia-northeast1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { image, mimeType = 'image/jpeg' } = request.data;

    if (!image || typeof image !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing base64 image data');
    }

    const db = getFirestore();
    const storage = getStorage();

    const jobRef = db.collection('jobs').doc();
    const jobId = jobRef.id;

    // Upload image to Storage
    const storagePath = `scans/${jobId}/image.jpeg`;
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    const buffer = Buffer.from(image, 'base64');
    const downloadToken = randomUUID();
    await file.save(buffer, {
      contentType: mimeType,
      metadata: { metadata: { firebaseStorageDownloadTokens: downloadToken } },
    });

    // Create Firestore job document
    await jobRef.set({
      type: 'scan',
      status: 'pending',
      userId: uid,
      input: {
        imageStoragePath: storagePath,
        mimeType,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { jobId };
  },
);
