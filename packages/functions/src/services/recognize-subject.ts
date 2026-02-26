import { Type } from '@google/genai';
import type { Schema, GoogleGenAI } from '@google/genai';
import { logger } from 'firebase-functions';
import type { SubjectRecognition } from '@brick-quest/shared';
import { withTimeout } from '../utils/with-timeout.js';
import { getThinkingConfig } from './gemini-client.js';
import { config } from '../config.js';

const RECOGNITION_TIMEOUT = 15_000; // 15s — Flash is fast

const recognitionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    subject: {
      type: Type.STRING,
      description: 'What the subject is (e.g. "unicorn", "golden retriever", "Mario")',
    },
    category: {
      type: Type.STRING,
      enum: ['character', 'animal', 'vehicle', 'building', 'food', 'object', 'scene'],
      description: 'Category of the subject',
    },
    keyFeatures: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Key visual features ordered by importance for recognizability (max 8)',
    },
    colorMap: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          hex: { type: Type.STRING, description: 'Closest LEGO hex color' },
          area: { type: Type.STRING, description: 'Body area this color covers' },
        },
        required: ['hex', 'area'],
      },
      description: 'Dominant colors mapped to body areas (max 8)',
    },
    proportions: {
      type: Type.OBJECT,
      properties: {
        widthToHeight: { type: Type.NUMBER, description: 'Width as fraction of height (0.3-2.0)' },
        depthToWidth: { type: Type.NUMBER, description: 'Depth as fraction of width (0.3-1.5)' },
      },
      required: ['widthToHeight', 'depthToWidth'],
    },
    bodySections: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Body sections from bottom to top (e.g. ["feet", "legs", "torso", "head"])',
    },
  },
  required: ['subject', 'category', 'keyFeatures', 'colorMap', 'proportions', 'bodySections'],
};

/**
 * Fast pre-identification of the subject in a reference image.
 * Uses Flash model (~2-5s) to extract metadata that guides voxel generation.
 * Returns null on failure (non-blocking — voxel gen proceeds without it).
 */
export async function recognizeSubject(
  ai: GoogleGenAI,
  base64Image: string,
  mimeType: string,
  userPrompt?: string
): Promise<SubjectRecognition | null> {
  try {
    const prompt = `Analyze this image and identify the MAIN SUBJECT for conversion into a 3D LEGO voxel model.

${userPrompt ? `User says: "${userPrompt}"\n` : ''}
INSTRUCTIONS:
1. Identify WHAT the subject is (be specific: "golden retriever puppy", not just "dog")
2. List the most DISTINCTIVE visual features that make it recognizable (horn, wings, glasses, hat, etc.)
3. Map the dominant colors to the closest standard LEGO hex colors:
   #FFFFFF (white), #000000 (black), #FF0000 (red), #0055BF (blue), #237841 (green),
   #FEC401 (yellow), #F97B22 (orange), #AA7D55 (medium nougat), #E4CD9E (tan),
   #A0A5A9 (light gray), #6C6E68 (dark gray), #7C503A (reddish brown), #D09168 (nougat),
   #B40000 (dark red), #003DA5 (dark blue), #352100 (dark brown), #75B5D4 (medium azure),
   #C870A0 (bright pink), #958A73 (dark tan), #009624 (dark green)
4. Estimate proportions as ratios (width:height, depth:width)
5. List body sections from BOTTOM to TOP (what a LEGO builder would stack)

Focus on GEOMETRY and STRUCTURE — what makes this object's 3D shape unique.
Ignore backgrounds, shadows, and non-subject elements.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: config.gemini.fastModel,
        contents: [
          { inlineData: { mimeType, data: base64Image } },
          { text: prompt },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: recognitionSchema,
          maxOutputTokens: 2048,
          thinkingConfig: getThinkingConfig(config.gemini.fastModel, 'minimal'),
        },
      }),
      RECOGNITION_TIMEOUT,
      'Subject recognition'
    );

    if (!response.text) {
      logger.warn('Subject recognition: empty response');
      return null;
    }

    const result: SubjectRecognition = JSON.parse(response.text);
    logger.info(`Subject recognized: "${result.subject}" (${result.category}), ${result.keyFeatures.length} features, ${result.colorMap.length} colors`);
    return result;
  } catch (error: any) {
    logger.warn(`Subject recognition failed (non-critical): ${error.message}`);
    return null;
  }
}

/**
 * Format recognition metadata into a system instruction preamble.
 * This is injected BEFORE the voxel generation prompt to ground the model.
 */
export function buildRecognitionContext(recognition: SubjectRecognition): string {
  const colorList = recognition.colorMap
    .map((c) => `  ${c.hex} → ${c.area}`)
    .join('\n');

  const sections = recognition.bodySections.join(' → ');

  // Category-specific structural guidelines
  const categoryGuidelines: Record<string, string> = {
    animal: `ANIMAL STRUCTURE: Must have head, body, and legs as distinct 3D regions. Use bilateral symmetry. Front face (Z=0) shows the face/snout. Ears/horns extend upward from head layers. Tail extends backward (high Z). Legs are separate columnar structures at the base.`,
    character: `CHARACTER STRUCTURE: Must have feet, legs, torso, arms, and head as distinct regions. BrickHeadz proportions — large head (~35-40% of height), compact body. Arms extend outward at torso layers. Front face (Z=0) shows facial features. Accessories (hat, glasses, held items) at appropriate layers.`,
    vehicle: `VEHICLE STRUCTURE: Must have body, wheels/treads, and cabin as distinct regions. Often elongated on one axis. Wheels are round/cylindrical at the base. Windows and details on the sides (X=0 and X=max faces).`,
    building: `BUILDING STRUCTURE: Must have foundation, walls, and roof as distinct vertical sections. Often rectangular footprint with greater depth. Windows and doors on the front face (Z=0). Roof tapers or overhangs at the top layers.`,
    food: `FOOD STRUCTURE: Focus on iconic shape silhouette. Use smooth color transitions. The object should be instantly recognizable from its outline alone.`,
    object: `OBJECT STRUCTURE: Focus on the most distinctive shape features. Ensure the silhouette is recognizable from at least 2 angles.`,
    scene: `SCENE STRUCTURE: Focus on the most prominent element. Build it as a single cohesive structure with the main element centered.`,
  };

  return `═══════════════════════════════════════
SUBJECT PRE-ANALYSIS (use this to guide your build)
═══════════════════════════════════════
IDENTIFIED SUBJECT: ${recognition.subject} (${recognition.category})

KEY FEATURES (in order of importance — ALL must be present in the final model):
${recognition.keyFeatures.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}

COLOR MAPPING (use these exact LEGO hex colors):
${colorList}

PROPORTIONS:
  Width:Height ratio ≈ ${recognition.proportions.widthToHeight.toFixed(2)}
  Depth:Width ratio ≈ ${recognition.proportions.depthToWidth.toFixed(2)}

BODY SECTIONS (build bottom → top): ${sections}

${categoryGuidelines[recognition.category] || categoryGuidelines.object}

CRITICAL: The finished model must be INSTANTLY RECOGNIZABLE as "${recognition.subject}". Every key feature listed above must be visible in the voxel grid. Use the color mapping to ensure correct color placement on each body area.
`;
}
