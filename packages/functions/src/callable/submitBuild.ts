import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { DetectedPart, Difficulty } from '@brick-quest/shared';

export const submitBuild = onCall(
  { maxInstances: 10 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { parts, difficulty = 'normal', userPrompt = '' } = request.data as {
      parts: DetectedPart[];
      difficulty?: Difficulty;
      userPrompt?: string;
    };

    if (!Array.isArray(parts) || parts.length === 0) {
      throw new HttpsError('invalid-argument', 'Missing or empty parts array');
    }

    const validDifficulties: Difficulty[] = ['beginner', 'normal', 'expert'];
    if (!validDifficulties.includes(difficulty)) {
      throw new HttpsError('invalid-argument', 'Invalid difficulty level');
    }

    const db = getFirestore();
    const jobRef = db.collection('jobs').doc();
    const jobId = jobRef.id;

    await jobRef.set({
      type: 'build',
      status: 'pending',
      userId: uid,
      input: {
        parts,
        difficulty,
        userPrompt,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { jobId };
  },
);
