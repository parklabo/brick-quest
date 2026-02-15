import { randomUUID } from 'crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { DesignDetail } from '@brick-quest/shared';

export const submitDesign = onCall(
  { maxInstances: 10, region: 'asia-northeast1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { image, mimeType = 'image/jpeg', detail = 'standard', userPrompt = '' } = request.data as {
      image: string;
      mimeType?: string;
      detail?: DesignDetail;
      userPrompt?: string;
    };

    if (!image || typeof image !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing base64 image data');
    }

    const validDetails: DesignDetail[] = ['simple', 'standard', 'detailed'];
    if (!validDetails.includes(detail)) {
      throw new HttpsError('invalid-argument', 'Invalid detail level');
    }

    const db = getFirestore();
    const storage = getStorage();

    const jobRef = db.collection('jobs').doc();
    const jobId = jobRef.id;

    // Upload image to Storage
    const storagePath = `designs/${jobId}/reference.jpeg`;
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
      type: 'design',
      status: 'pending',
      userId: uid,
      input: {
        imageStoragePath: storagePath,
        mimeType,
        detail,
        userPrompt,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { jobId };
  },
);
