import { Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { config } from '../config.js';
import { logger } from 'firebase-functions';
import type { ScanResult } from '@brick-quest/shared';
import { getGeminiShapeEnum, getGeminiShapeDescriptions, resolveShape } from '@brick-quest/shared';
import { withTimeout } from '../utils/with-timeout.js';
import { getAI, getThinkingConfig } from './gemini-client.js';

const SCAN_TIMEOUT = 5 * 60 * 1000;
const SCAN_RETRIES = 2;

function isRetryableModelError(error: any): boolean {
  const msg = String(error?.message || '');
  return /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(msg);
}

export async function analyzeLegoParts(base64Image: string, mimeType = 'image/jpeg'): Promise<ScanResult> {
  const ai = getAI();

  const partSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      aiInsight: {
        type: Type.STRING,
        description: 'A short, expert commentary on the collection. Identify themes, color palettes, or potential build types.',
      },
      parts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Common name, e.g. '2x4 Brick'" },
            color: { type: Type.STRING, description: 'Simple LEGO-like color name' },
            hexColor: { type: Type.STRING, description: "CSS hex color code, e.g. '#FF0000'" },
            count: { type: Type.INTEGER, description: 'How many visible (conservative estimate)' },
            type: {
              type: Type.STRING,
              enum: ['brick', 'plate', 'tile', 'slope', 'technic', 'minifig', 'other'],
            },
            shape: { type: Type.STRING, enum: getGeminiShapeEnum() },
            width: { type: Type.INTEGER, description: 'Width in studs (shorter side)' },
            length: { type: Type.INTEGER, description: 'Length in studs (longer side)' },
          },
          required: ['name', 'color', 'hexColor', 'count', 'type', 'shape', 'width', 'length'],
        },
      },
    },
    required: ['parts', 'aiInsight'],
  };

  const prompt = `Analyze this image of mixed interlocking plastic bricks.
Sort and group visible parts by TYPE, SHAPE, COLOR and SIZE (in studs).
Then provide a short expert insight about what could be built with them.

IMPORTANT:
- Only describe parts that are at least partially visible.
- Never invent parts not in the image.
- If partially hidden, under-estimate the count.
- Merge identical parts (same type, shape, color, width, length) into one entry.

Types: brick (tall), plate (thin), tile (smooth top), slope (wedge/roof), technic (holes), minifig (people), other.

SHAPES (choose the most specific match):
${getGeminiShapeDescriptions()}

Colors: use simple names like "red", "dark green", "light gray".

Return ONLY valid JSON matching the schema.`;

  // Scan uses fast model (3 Flash) with fallback to primary model (3.1 Pro)
  const modelsToTry = [config.gemini.fastModel, config.gemini.model];
  let lastError: Error | null = null;
  let data: any = {};

  outer: for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= SCAN_RETRIES; attempt++) {
      try {
        logger.info(`Scan attempt ${attempt}/${SCAN_RETRIES} (model: ${model})`);

        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: [{ text: prompt }, { inlineData: { mimeType, data: base64Image } }],
            config: {
              responseMimeType: 'application/json',
              responseSchema: partSchema,
              thinkingConfig: getThinkingConfig(model, 'low'),
              systemInstruction: 'You are an expert brick sorter. Be precise and conservative. Return only valid JSON.',
            },
          }),
          SCAN_TIMEOUT,
          'Image analysis'
        );

        data = JSON.parse(response.text || '{}');
        break outer;
      } catch (error: any) {
        logger.error(`Scan attempt ${attempt} failed (${model}):`, error.message);
        lastError = error;
        if (!isRetryableModelError(error)) break; // non-retryable → try next model
        if (attempt < SCAN_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
        }
      }
    }
  }

  if (!data.parts && lastError) throw lastError;
  const rawParts: any[] = Array.isArray(data.parts) ? data.parts : [];

  // Merge duplicates
  const mergedMap = new Map<string, any>();
  for (const p of rawParts) {
    if (!p) continue;
    const key = [p.type, p.shape || 'rectangle', p.color, p.hexColor, `${p.width}x${p.length}`].join('|');
    const existing = mergedMap.get(key);
    if (existing) {
      existing.count += p.count ?? 0;
    } else {
      mergedMap.set(key, { ...p });
    }
  }

  const parts = Array.from(mergedMap.values()).map((p: any, idx: number) => ({
    id: `detected-${idx}`,
    name: p.name,
    color: p.color,
    hexColor: p.hexColor,
    count: p.count,
    type: p.type,
    shape: resolveShape(p.shape || 'rectangle', p.type),
    dimensions: { width: p.width, length: p.length },
  }));

  logger.info(`Detected ${parts.length} unique part types`);

  return {
    parts,
    aiInsight: data.aiInsight || 'A fascinating collection of bricks.',
  };
}
