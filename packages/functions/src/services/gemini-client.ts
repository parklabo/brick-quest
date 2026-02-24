import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { ThinkingConfig } from '@google/genai';

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

const LEVEL_MAP: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

const BUDGET_MAP: Record<string, number> = {
  minimal: 1024,
  low: 4096,
  medium: 16384,
  high: 32768,
};

/**
 * Returns the correct thinkingConfig for a model.
 * - Gemini 3.x: uses `thinkingLevel` (enum)
 * - Gemini 2.5: uses `thinkingBudget` (token count)
 */
export function getThinkingConfig(model: string, level: 'minimal' | 'low' | 'medium' | 'high'): ThinkingConfig {
  if (model.startsWith('gemini-3')) {
    return { thinkingLevel: LEVEL_MAP[level] };
  }
  return { thinkingBudget: BUDGET_MAP[level] };
}
