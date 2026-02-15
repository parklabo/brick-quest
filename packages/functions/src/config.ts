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
