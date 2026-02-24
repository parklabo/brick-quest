import { GoogleGenAI } from '@google/genai';

let _ai: GoogleGenAI | undefined;

/**
 * Returns a GoogleGenAI client.
 * - Production (Cloud Functions): Vertex AI with automatic service account auth (reliable, SLA 99.9%)
 * - Local development: API key from .env.local (fallback for Docker emulators)
 */
export const getAI = () =>
  (_ai ??= process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : new GoogleGenAI({ vertexai: true, project: 'brick-quest', location: 'global' }));
