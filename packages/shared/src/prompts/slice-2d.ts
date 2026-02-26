import type { DesignDetail } from '../types/brick.js';

/** Grid size limits by detail level — must stay in sync with voxel-grid.ts */
const DESIGN_GRID_LIMITS: Record<DesignDetail, { maxW: number; maxD: number; maxLayers: number }> = {
  simple: { maxW: 12, maxD: 12, maxLayers: 16 },
  standard: { maxW: 20, maxD: 18, maxLayers: 28 },
  detailed: { maxW: 28, maxD: 24, maxLayers: 36 },
};

/**
 * Prompt: analyze the composite views and extract dimensions, palette, and body sections.
 * Returns JSON: { width, depth, totalLayers, palette, sections, title, description, lore, referenceDescription }
 */
export function buildSliceAnalysisPrompt(detail: DesignDetail, userPrompt: string): string {
  const limits = DESIGN_GRID_LIMITS[detail];

  return `You are a LEGO Master Builder analyzing composite orthographic views to plan a 3D voxel model.

COMPOSITE VIEWS (2×2 grid):
- Top-left: Hero 3/4 angle — overall shape & proportions
- Top-right: FRONT view — face, front colors, width
- Bottom-left: RIGHT SIDE view — profile, depth
- Bottom-right: BACK view — rear details

TASK: Analyze the views and output a build plan with dimensions and color palette.

IMPORTANT — FOCUS ON THE MAIN SUBJECT ONLY:
- The model may have a background, base plate, or decorative backdrop. IGNORE these.
- Only measure the main subject (character, animal, object) — NOT the background.
- depth should reflect the SUBJECT's depth from front to back, not the total scene depth.
- For characters/animals, depth is typically 40-70% of width.

COUNT STUDS IN THE VIEWS:
1. FRONT VIEW: Count the SUBJECT's width in studs (left→right columns). Set width ≤ ${limits.maxW}.
2. SIDE VIEW: Count only the SUBJECT's depth in studs (ignore background panels/walls). Set depth ≤ ${limits.maxD}.
   - For a character: depth is typically body thickness (e.g., 6-12 studs).
   - If the side view shows a flat background panel behind the subject, do NOT include it in depth.
3. FRONT VIEW: Count the SUBJECT's height in layers (bottom→top). Set totalLayers ≤ ${limits.maxLayers}.
   - Use AT LEAST ${Math.ceil(limits.maxLayers * 0.8)} layers to maximize detail.

PALETTE: List every distinct color visible on the SUBJECT. Map each to the closest LEGO hex color.
Common LEGO colors: #FFFFFF (white), #000000 (black), #FF0000 (red), #0055BF (blue), #237841 (green), #FEC401 (yellow), #F97B22 (orange), #AA7D55 (medium nougat), #E4CD9E (tan), #A0A5A9 (light gray), #6C6E68 (dark gray), #7C503A (reddish brown), #D09168 (nougat), #B40000 (dark red), #003DA5 (dark blue), #352100 (dark brown), #75B5D4 (medium azure), #C870A0 (bright pink), #958A73 (dark tan)

SECTIONS: Divide the SUBJECT into body sections from bottom to top (e.g. feet, legs, torso, neck, head, hair, ears).
For each section, specify:
- name: descriptive label
- layerStart / layerEnd: layer range (0-indexed from bottom). Sections MUST cover ALL layers 0→totalLayers-1 with no gaps.
- dominantColor: hex color for the interior fill of this section
- widthAtSection: how wide this section is in studs (must be ≤ width)
- depthAtSection: how deep this section is in studs (must be ≤ depth)

${userPrompt ? `USER NOTE: "${userPrompt}"\n` : ''}
Return ONLY valid JSON matching the schema.`;
}

export type SliceFace = 'front' | 'side' | 'back';

/**
 * Prompt: generate a single 2D face grid from the composite views.
 * The AI outputs a 2D array [layer][column] of hex color strings.
 */
export function buildSliceFacePrompt(
  face: SliceFace,
  analysis: { width: number; depth: number; totalLayers: number; palette: { hex: string; name: string }[] },
  detail: DesignDetail
): string {
  const columns = face === 'side' ? analysis.depth : analysis.width;
  const rows = analysis.totalLayers;

  const detailHint: Record<DesignDetail, string> = {
    simple: 'Use broad color areas, minimal detail per cell.',
    standard: 'Balance detail and simplicity. Capture key features.',
    detailed: 'Maximize detail: capture every visible feature, accessory, and color transition.',
  };

  const faceInstructions: Record<SliceFace, string> = {
    front: `Look at the TOP-RIGHT quadrant (FRONT VIEW).
Read the colors column-by-column, left→right = X positions 0→${columns - 1}.
Read rows bottom→top = layer 0→${rows - 1}.
This face maps to Z=0 (front row) of the 3D grid.`,
    side: `Look at the BOTTOM-LEFT quadrant (RIGHT SIDE VIEW).
Read the colors column-by-column, left→right = Z positions 0→${columns - 1}.
Read rows bottom→top = layer 0→${rows - 1}.
This face maps to X=max (rightmost column) of the 3D grid.
Left side is assumed to mirror the right side.`,
    back: `Look at the BOTTOM-RIGHT quadrant (BACK VIEW).
Read the colors column-by-column, RIGHT→LEFT = X positions 0→${columns - 1}.
(Back view is reversed horizontally relative to front.)
Read rows bottom→top = layer 0→${rows - 1}.
This face maps to Z=max (back row) of the 3D grid.`,
  };

  const paletteList = analysis.palette.map((c) => `  ${c.hex} (${c.name})`).join('\n');

  return `You are a LEGO Master Builder converting an orthographic view into a 2D color grid.

${faceInstructions[face]}

OUTPUT FORMAT:
A 2D array of ${rows} rows × ${columns} columns.
grid[layer][column] = hex color string or "" for empty/background.

RULES:
1. Use ONLY these colors from the palette:
${paletteList}
2. grid[0] is the BOTTOM layer (ground level), grid[${rows - 1}] is the TOP.
3. Mark background/air/backdrop cells as "" (empty string). ONLY fill cells belonging to the MAIN SUBJECT.
4. If the view shows a background panel, wall, or decorative backdrop behind the subject — mark those as "".
5. Every cell inside the SUBJECT's silhouette MUST be filled — no holes.
6. Be PRECISE: count studs carefully to match the view exactly.
7. Include ALL features visible in this view: eyes, mouth, glasses, accessories, patterns.
8. Each row must have exactly ${columns} elements.

DETAIL LEVEL: ${detail.toUpperCase()} — ${detailHint[detail]}

Return ONLY a JSON array of arrays (no wrapper object). Example format:
[
  ["#FF0000", "#FF0000", "", ""],
  ["#0055BF", "#0055BF", "#0055BF", ""]
]`;
}
