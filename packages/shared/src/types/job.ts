export type JobStatus =
  | 'pending'
  | 'processing'
  | 'generating_views'
  | 'views_ready'
  | 'generating_build'
  | 'completed'
  | 'failed';

export type JobType = 'scan' | 'build' | 'design';

export interface JobState<T = unknown> {
  id: string;
  type: JobType;
  userId: string;
  status: JobStatus;
  progress: number; // 0-100
  result?: T;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
