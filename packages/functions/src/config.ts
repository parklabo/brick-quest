export const config = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3-pro-preview',
    imageModel: process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview',
  },
  firebase: {
    storageBucket: process.env.GCLOUD_STORAGE_BUCKET || '',
  },
};

/** Shared validation limits used across callable functions */
export const LIMITS = {
  /** ~10 MB base64 image size */
  IMAGE_SIZE_BYTES: 15_000_000,
  /** Max user prompt length */
  PROMPT_MAX_CHARS: 500,
  /** Max parts in a build request */
  PARTS_MAX_COUNT: 500,
} as const;
