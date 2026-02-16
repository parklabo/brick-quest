import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import type { DetectedPart, Difficulty, DesignDetail } from '@brick-quest/shared';

export const apiClient = {
  async submitScan(image: string): Promise<{ jobId: string }> {
    const callable = httpsCallable<{ image: string; mimeType?: string }, { jobId: string }>(
      functions,
      'submitScan',
    );
    const { data } = await callable({ image });
    return data;
  },

  async submitBuild(
    parts: DetectedPart[],
    difficulty: Difficulty = 'normal',
    userPrompt = '',
  ): Promise<{ jobId: string }> {
    const callable = httpsCallable<
      { parts: DetectedPart[]; difficulty: Difficulty; userPrompt: string },
      { jobId: string }
    >(functions, 'submitBuild');
    const { data } = await callable({ parts, difficulty, userPrompt });
    return data;
  },

  async submitDesign(
    image: string,
    detail: DesignDetail = 'detailed',
    userPrompt = '',
  ): Promise<{ jobId: string }> {
    const callable = httpsCallable<
      { image: string; mimeType?: string; detail: DesignDetail; userPrompt: string },
      { jobId: string }
    >(functions, 'submitDesign');
    const { data } = await callable({ image, detail, userPrompt });
    return data;
  },

  async approveDesignViews(jobId: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<{ jobId: string }, { success: boolean }>(
      functions,
      'approveDesignViews',
    );
    const { data } = await callable({ jobId });
    return data;
  },

  async regenerateDesignViews(jobId: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<{ jobId: string }, { success: boolean }>(
      functions,
      'regenerateDesignViews',
    );
    const { data } = await callable({ jobId });
    return data;
  },

  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<{ jobId: string }, { success: boolean }>(
      functions,
      'cancelJob',
    );
    const { data } = await callable({ jobId });
    return data;
  },
};
