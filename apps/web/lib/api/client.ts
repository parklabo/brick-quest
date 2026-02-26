import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import type { DetectedPart, Difficulty, DesignDetail, DesignStrategy } from '@brick-quest/shared';

export const apiClient = {
  async submitScan(image: string): Promise<{ jobId: string }> {
    const callable = httpsCallable<{ image: string; mimeType?: string }, { jobId: string }>(functions, 'submitScan');
    const { data } = await callable({ image });
    return data;
  },

  async submitBuild(parts: DetectedPart[], difficulty: Difficulty = 'normal', userPrompt = ''): Promise<{ jobId: string }> {
    const callable = httpsCallable<{ parts: DetectedPart[]; difficulty: Difficulty; userPrompt: string }, { jobId: string }>(
      functions,
      'submitBuild'
    );
    const { data } = await callable({ parts, difficulty, userPrompt });
    return data;
  },

  async submitDesign(image: string, detail: DesignDetail = 'detailed', userPrompt = '', strategy: DesignStrategy = 'full-grid'): Promise<{ jobId: string }> {
    const callable = httpsCallable<{ image: string; mimeType?: string; detail: DesignDetail; userPrompt: string; strategy: DesignStrategy }, { jobId: string }>(
      functions,
      'submitDesign'
    );
    const { data } = await callable({ image, detail, userPrompt, strategy });
    return data;
  },

  async approveDesignViews(jobId: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<{ jobId: string }, { success: boolean }>(functions, 'approveDesignViews');
    const { data } = await callable({ jobId });
    return data;
  },

  async regenerateDesignViews(jobId: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<{ jobId: string }, { success: boolean }>(functions, 'regenerateDesignViews');
    const { data } = await callable({ jobId });
    return data;
  },

  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<{ jobId: string }, { success: boolean }>(functions, 'cancelJob');
    const { data } = await callable({ jobId });
    return data;
  },

  async retryJob(jobId: string): Promise<{ jobId: string }> {
    const callable = httpsCallable<{ jobId: string }, { jobId: string }>(functions, 'retryJob');
    const { data } = await callable({ jobId });
    return data;
  },

  async deleteJob(jobId: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<{ jobId: string }, { success: boolean }>(functions, 'deleteJob');
    const { data } = await callable({ jobId });
    return data;
  },

  async rebuildDesignBuild(jobId: string): Promise<{ success: boolean }> {
    const callable = httpsCallable<{ jobId: string }, { success: boolean }>(functions, 'rebuildDesignBuild');
    const { data } = await callable({ jobId });
    return data;
  },
};
