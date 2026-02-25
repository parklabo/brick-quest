export interface UserProfile {
  displayName: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp — jobs with createdAt <= this are considered "seen" */
  jobsSeenBefore?: string;
  /** Explicitly seen job IDs for jobs created after jobsSeenBefore */
  seenJobIds?: string[];
}
