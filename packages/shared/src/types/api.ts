export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface ScanRequest {
  image: string; // base64
  mimeType?: string;
}

export interface ScanResponse {
  jobId: string;
}

export interface BuildRequest {
  parts: import('./brick.js').DetectedPart[];
  difficulty?: import('./brick.js').Difficulty;
  userPrompt?: string;
}

export interface BuildResponse {
  jobId: string;
}
