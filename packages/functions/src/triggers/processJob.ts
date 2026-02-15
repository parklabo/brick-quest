import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { analyzeLegoParts } from '../services/geminiScan.js';
import { generateBuildPlan } from '../services/geminiBuild.js';
import { generateDesignFromPhoto, generateLegoPreview, generateOrthographicViews } from '../services/geminiDesign.js';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

export const processJob = onDocumentCreated(
  {
    document: 'jobs/{jobId}',
    memory: '1GiB',
    timeoutSeconds: 540,
    secrets: [geminiApiKey],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn('No data associated with the event');
      return;
    }

    const data = snapshot.data();
    const jobId = event.params.jobId;
    const db = getFirestore();
    const jobRef = db.collection('jobs').doc(jobId);

    // Idempotency: only process pending jobs
    if (data.status !== 'pending') {
      logger.info(`Job ${jobId} is not pending (status: ${data.status}), skipping`);
      return;
    }

    // Mark as processing
    await jobRef.update({
      status: 'processing',
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      if (data.type === 'scan') {
        const { imageStoragePath, mimeType } = data.input;

        // Download image from Storage
        const storage = getStorage();
        const bucket = storage.bucket();
        const file = bucket.file(imageStoragePath);
        const [buffer] = await file.download();
        const base64Image = buffer.toString('base64');

        logger.info(`Processing scan job ${jobId}`);
        const result = await analyzeLegoParts(base64Image, mimeType);

        await jobRef.update({
          status: 'completed',
          result,
          updatedAt: FieldValue.serverTimestamp(),
        });

        logger.info(`Scan job ${jobId} completed: ${result.parts.length} parts detected`);
      } else if (data.type === 'build') {
        const { parts, difficulty, userPrompt } = data.input;

        logger.info(`Processing build job ${jobId}`);
        const result = await generateBuildPlan(parts, difficulty, userPrompt);

        await jobRef.update({
          status: 'completed',
          result,
          updatedAt: FieldValue.serverTimestamp(),
        });

        logger.info(`Build job ${jobId} completed: ${result.steps.length} steps`);
      } else if (data.type === 'design') {
        const { imageStoragePath, mimeType, detail, userPrompt } = data.input;

        // Step 1: Generate orthographic views
        await jobRef.update({
          status: 'generating_views',
          updatedAt: FieldValue.serverTimestamp(),
        });

        const storage = getStorage();
        const bucket = storage.bucket();
        const file = bucket.file(imageStoragePath);
        const [buffer] = await file.download();
        const base64Image = buffer.toString('base64');

        logger.info(`Design job ${jobId}: generating composite views`);
        const compositeImage = await generateOrthographicViews(base64Image, mimeType, detail, userPrompt);

        // Upload single composite view image to Storage
        const compositePath = `designs/${jobId}/views_composite.png`;
        await bucket.file(compositePath).save(Buffer.from(compositeImage.data, 'base64'), { contentType: compositeImage.mimeType });

        logger.info(`Design job ${jobId}: composite views uploaded, transitioning to views_ready`);

        await jobRef.update({
          status: 'views_ready',
          views: { composite: compositePath },
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        throw new Error(`Unknown job type: ${data.type}`);
      }
    } catch (error: any) {
      logger.error(`Job ${jobId} failed:`, error.message);

      await jobRef.update({
        status: 'failed',
        error: error.message || 'Unknown error',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);

/**
 * Handles two design-related status transitions:
 * 1. views_ready → generating_views  (regeneration: re-generate composite views)
 * 2. * → generating_build            (build: generate build plan from views)
 */
export const processDesignUpdate = onDocumentUpdated(
  {
    document: 'jobs/{jobId}',
    memory: '1GiB',
    timeoutSeconds: 540,
    secrets: [geminiApiKey],
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || after.type !== 'design') return;

    const jobId = event.params.jobId;
    const db = getFirestore();
    const jobRef = db.collection('jobs').doc(jobId);

    // --- Case 1: Regenerate views (views_ready → generating_views) ---
    if (before.status === 'views_ready' && after.status === 'generating_views') {
      try {
        const { imageStoragePath, mimeType, detail, userPrompt } = after.input;

        const storage = getStorage();
        const bucket = storage.bucket();
        const [buffer] = await bucket.file(imageStoragePath).download();
        const base64Image = buffer.toString('base64');

        logger.info(`Regenerating composite views for job ${jobId}`);
        const compositeImage = await generateOrthographicViews(base64Image, mimeType, detail, userPrompt);

        const compositePath = `designs/${jobId}/views_composite.png`;
        await bucket.file(compositePath).save(Buffer.from(compositeImage.data, 'base64'), { contentType: compositeImage.mimeType });

        await jobRef.update({
          status: 'views_ready',
          views: { composite: compositePath },
          updatedAt: FieldValue.serverTimestamp(),
        });

        logger.info(`Views regenerated for job ${jobId}`);
      } catch (error: any) {
        logger.error(`View regeneration failed for job ${jobId}:`, error.message);

        // Restore to views_ready so user can retry (old composite still exists)
        await jobRef.update({
          status: 'views_ready',
          updatedAt: FieldValue.serverTimestamp(),
        }).catch(() => {});
      }
      return;
    }

    // --- Case 2: Generate build plan (* → generating_build) ---
    if (before.status !== 'generating_build' && after.status === 'generating_build') {
      try {
        const { imageStoragePath, mimeType, detail, userPrompt } = after.input;
        const viewPaths = after.views as { composite: string };

        const storage = getStorage();
        const bucket = storage.bucket();

        // Download reference image + composite views in parallel
        const [refBuffer, compositeBuffer] = await Promise.all([
          bucket.file(imageStoragePath).download().then(([b]) => b),
          bucket.file(viewPaths.composite).download().then(([b]) => b),
        ]);

        const base64Image = refBuffer.toString('base64');
        const compositeView = { data: compositeBuffer.toString('base64'), mimeType: 'image/png' };

        logger.info(`Design job ${jobId}: generating build plan from composite views`);
        const result = await generateDesignFromPhoto(base64Image, mimeType, detail, userPrompt, compositeView);

        // Generate LEGO-style preview image (non-blocking — failure is OK)
        const preview = await generateLegoPreview(base64Image, mimeType, result.referenceDescription);
        if (preview) {
          const previewPath = `designs/${jobId}/preview.png`;
          await bucket.file(previewPath).save(Buffer.from(preview.data, 'base64'), {
            contentType: preview.mimeType,
          });
          result.previewImageStoragePath = previewPath;
          logger.info(`Preview image saved to ${previewPath}`);
        }

        await jobRef.update({
          status: 'completed',
          result,
          updatedAt: FieldValue.serverTimestamp(),
        });

        logger.info(`Design job ${jobId} completed: ${result.buildPlan.steps.length} steps, ${result.requiredParts.length} parts`);
      } catch (error: any) {
        logger.error(`Design build job ${jobId} failed:`, error.message);

        await jobRef.update({
          status: 'failed',
          error: error.message || 'Unknown error',
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
  },
);
