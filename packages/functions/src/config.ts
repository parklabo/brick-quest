export const config = {
  gemini: {
    /** Primary reasoning model for complex tasks (build, design) */
    model: process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview',
    /** Fast model for simple tasks (scan) — Pro-level quality at Flash speed/cost */
    fastModel: process.env.GEMINI_FAST_MODEL || 'gemini-3-flash-preview',
    /** Text fallback on 503/429 errors */
    fallbackModel: process.env.GEMINI_FALLBACK_MODEL || 'gemini-3-flash-preview',
    /** Ordered fallback chain: 3.1 Pro → 3.0 Pro → 3.0 Flash */
    modelChain: [
      process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview',
      'gemini-3-pro-preview',
      process.env.GEMINI_FALLBACK_MODEL || 'gemini-3-flash-preview',
    ],
    /** Primary image generation model */
    imageModel: process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview',
    /** Image fallback on 503/429 errors */
    fallbackImageModel: process.env.GEMINI_FALLBACK_IMAGE_MODEL || 'gemini-2.5-flash-image',
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
  /** Max agent iteration loop attempts for build/design jobs */
  AGENT_MAX_ITERATIONS: 3,
  /** Physics drop threshold: retry if dropped percentage exceeds this */
  DROP_THRESHOLD_PCT: 15,
  /** Physics drop threshold: retry if absolute dropped count exceeds this */
  DROP_THRESHOLD_ABS: 5,
} as const;
