import type { DesignDetail, Difficulty } from '../types/brick.js';

/** Grid size limits by detail level for design flow */
const DESIGN_GRID_LIMITS: Record<DesignDetail, { maxW: number; maxD: number; maxLayers: number; label: string }> = {
  simple: { maxW: 12, maxD: 12, maxLayers: 16, label: '12×12 base, up to 16 layers (~2,304 cells max)' },
  standard: { maxW: 20, maxD: 18, maxLayers: 28, label: '20×18 base, up to 28 layers (~10,080 cells max)' },
  detailed: { maxW: 28, maxD: 24, maxLayers: 36, label: '28×24 base, up to 36 layers (~24,192 cells max)' },
};

/** Grid size limits by difficulty for build flow */
const BUILD_GRID_LIMITS: Record<Difficulty, { maxW: number; maxD: number; maxLayers: number; label: string }> = {
  beginner: { maxW: 12, maxD: 12, maxLayers: 16, label: '12×12 base, up to 16 layers' },
  normal: { maxW: 20, maxD: 18, maxLayers: 28, label: '20×18 base, up to 28 layers' },
  expert: { maxW: 28, maxD: 24, maxLayers: 36, label: '28×24 base, up to 36 layers' },
};

const VOXEL_GRID_CORE_PROMPT = `═══════════════════════════════════════
3D VOXEL GRID OUTPUT FORMAT
═══════════════════════════════════════
You will output a 3D COLOR GRID — NOT individual brick coordinates.
Each layer is a 2D grid of stud positions. Each cell = 1 stud = 1 unit.

GRID RULES:
- grid[z][x] — row z (front=0 → back), column x (left=0 → right)
- Each cell value = hex color string (e.g. "#FF0000") or "" for empty
- Layer y=0 is the ground. Layers stack upward.
- heightType: "brick" = 1.2 unit tall layer, "plate" = 0.4 unit tall layer

HEIGHT TYPE STRATEGY:
- Use "plate" for ALL detail-rich layers: eye lines, mouth, glasses, belt, collar, chin, shoe soles, accessories
- Use "brick" ONLY for large monotone sections: solid body core, solid legs, plain head fill
- When in doubt, use "plate" — it gives 3× more vertical resolution for detail
- A good model uses ~40-60% plate layers and ~40-60% brick layers

STRUCTURAL RULES (CRITICAL):
1. ABSOLUTELY NO HOLES: Every cell inside the model silhouette MUST be filled. Think of it as a solid sculpture — no empty cells inside the outline. Scan each row: if a cell is between two filled cells, it MUST be filled.
2. CONNECTED LAYERS: Each layer's filled region must overlap the layer below by at least 50%. No floating sections.
3. SMOOTH TAPERING: Reduce footprint gradually — max 1-2 studs narrower per side per layer.
4. GROUND CONTACT: Layer 0 forms the base. Legs/feet should be solid with no gaps between them.
5. FILL THE GRID: Use the MAXIMUM available grid space. The model should be as large as possible within the limits. A tiny model in a big grid = wasted resolution = bad result.
6. FRONT FACE IS KEY: Z=0 is the front face. Put the most detail here (face, eyes, chest details).

COLOR RULES:
- Use standard LEGO hex colors consistently
- Common: #FFFFFF (white), #000000 (black), #FF0000 (red), #0055BF (blue), #237841 (green), #FEC401 (yellow), #F97B22 (orange), #AA7D55 (medium nougat), #E4CD9E (tan), #A0A5A9 (light gray), #6C6E68 (dark gray), #7C503A (reddish brown), #D09168 (nougat/flesh), #B40000 (dark red), #009624 (dark green), #352100 (dark brown), #003DA5 (dark blue), #75B5D4 (medium azure), #C870A0 (bright pink), #958A73 (dark tan)
- Map the subject's real colors to the closest LEGO color
- Be consistent: once you pick a hex for "skin" or "hair", use that EXACT hex everywhere
- Use contrasting colors for features (dark eyes on light face, etc.)
- Each distinctive feature needs its own contrasting color`;

const VOXEL_DESIGN_PROCESS = `═══════════════════════════════════════
DESIGN PROCESS (follow these steps IN ORDER)
═══════════════════════════════════════
STEP 1 — ANALYZE & PLAN THE MODEL:
  a) Study the reference carefully. List EVERY visible feature: body parts, clothing, accessories, held items, facial features, patterns, logos
  b) Map body sections bottom→top with EXACT layer allocations:
     - Feet/shoes: 2-4 layers (plate for soles, brick for bulk)
     - Legs: 4-8 layers
     - Torso/body: 6-10 layers (includes arms, held items)
     - Neck: 1-2 plate layers
     - Head/face: 6-10 layers (plates for eye/mouth detail)
     - Hair/hat/ears: 3-6 layers
     - Accessories on top: 1-3 layers
  c) Total layers MUST be close to the maximum allowed (within 80%).
  d) For each section, determine width (X) and depth (Z) in studs.
  e) Map each feature to a specific LEGO hex color. Pick these NOW.

STEP 2 — MAP VIEWS TO GRID AXES:
  - FRONT VIEW (top-right quadrant) → the Z=0 face. Read left→right = X positions.
  - SIDE VIEW (bottom-left quadrant) → the X=max face. Read left→right = Z positions (front→back).
  - BACK VIEW (bottom-right quadrant) → the Z=max face. Read right→left = X positions.
  - HERO VIEW (top-left quadrant) → confirms 3D shape and overall proportions.

  PIXEL COUNTING TECHNIQUE:
  Count studs in the views! If the front view shows the character is 14 studs wide → set grid width=14.
  If the side view shows 10 studs deep → set grid depth=10.
  If the front view shows 24 rows tall → use 24+ layers.

STEP 3 — BUILD LAYER BY LAYER (y=0 upward):
  For each layer:
  a) Look at the FRONT VIEW at this height. What colors do you see across the width?
     → That entire row of colors goes into Z=0 (front row) of this layer's grid.
  b) Look at the SIDE VIEW at this height. What colors do you see across the depth?
     → That column of colors goes into X=max (right column) of this layer's grid.
  c) Look at the BACK VIEW at this height.
     → That row goes into Z=max (back row), but REVERSED left-to-right.
  d) Fill ALL interior cells with the dominant color for this section.
  e) For detail layers (eyes, mouth, accessories):
     → Use heightType="plate" for precise vertical placement
     → Place feature colors at exact grid positions matching the view
  f) For protrusions (arms, ears, tail, held items):
     → Extend the grid boundary outward at the appropriate layers

STEP 4 — FINAL VERIFICATION:
  □ Layer count within 80% of maximum allowed
  □ Grid width/depth matches the subject proportions from the views
  □ Every layer is fully filled (no holes inside the silhouette)
  □ ALL features present: eyes, mouth/beak, ears, hair, glasses, accessories, clothing details
  □ Front face (Z=0) matches the FRONT VIEW color-for-color
  □ Color palette is consistent across all layers
  □ Plate layers used for all detail transitions (eyes, mouth, belt, collar)`;

const VOXEL_WORKED_EXAMPLE = `═══════════════════════════════════════
WORKED EXAMPLE — Cat with Glasses (10×8 base, 16 layers)
═══════════════════════════════════════
Sections: feet(2 brick) → body(4 brick) → arms(included) → neck(1 plate) → face(3 plate+1 brick) → eyes+glasses(2 plate) → forehead(1 brick) → ears(2 plate)
Palette: body=#003DA5 (dark blue), face=#FFFFFF (white), ears=#003DA5, eyes=#000000, glasses=#000000, nose=#C870A0 (pink), feet=#6C6E68 (dark gray)

Layer 0-1 (feet, 8x6): heightType="brick"
  grid = [
    ["#6C6E68","#6C6E68","#6C6E68","","","#6C6E68","#6C6E68","#6C6E68"],
    ["#6C6E68","#6C6E68","#6C6E68","","","#6C6E68","#6C6E68","#6C6E68"],
    ["#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68"],
    ["#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68"],
    ["#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68"],
    ["#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68","#6C6E68"]
  ]

Layer 2-5 (body, 10x8): heightType="brick"
  grid = [
    ["#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5"],
    ["#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5"],
    ["#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5","#003DA5"],
    ...6 more rows all #003DA5...
  ]

Layer 6 (neck, plate): heightType="plate" — narrower transition
Layer 7-9 (face, lower): heightType="plate" — white face, pink nose at Z=0
Layer 10 (eyes+glasses): heightType="plate"
  grid front row (Z=0) = ["#FFFFFF","#000000","#000000","#FFFFFF","#FFFFFF","#FFFFFF","#000000","#000000","#FFFFFF","#FFFFFF"]
  ← glasses frames around eyes, visible from front

Layer 11 (forehead): heightType="brick"
Layer 12-13 (top of head): heightType="brick"
Layer 14-15 (ears, narrower): heightType="plate"
  Only cells at X=1-2 and X=7-8 filled with #003DA5, rest empty ← ear tips

Result: 16 layers, ~800+ voxels → ~200+ bricks. The cat is recognizable with glasses, colored body, white face, and pointed ears.`;

/**
 * Build the voxel grid prompt for the DESIGN flow (photo → LEGO).
 * The AI receives composite views and outputs a VoxelGrid.
 * When isRetry=true, omits the worked example to save ~400 tokens.
 */
export function buildVoxelDesignPrompt(detail: DesignDetail, userPrompt: string, hasCompositeView: boolean, isRetry = false): string {
  const limits = DESIGN_GRID_LIMITS[detail];

  const viewsInstruction = hasCompositeView
    ? `
═══════════════════════════════════════
COMPOSITE VIEWS — YOUR BLUEPRINT
═══════════════════════════════════════
You have a 2×2 grid image showing 4 views of the EXACT model you must recreate:
- Top-left: Hero 3/4 angle → overall shape, proportions, depth
- Top-right: FRONT view → face/front details, colors per row, feature positions
- Bottom-left: RIGHT SIDE view → profile silhouette, depth per row
- Bottom-right: BACK view → rear details, back colors

HOW TO USE THE VIEWS AS A PIXEL MAP:
1. COUNT the height of the model in the FRONT view (in visible brick rows).
   This tells you how many layers you need. Scale up to fill the max layers.
2. COUNT the width in the FRONT view (in studs). Scale to fill max width.
3. COUNT the depth in the SIDE view (in studs). Scale to fill max depth.
4. For EACH layer (row from bottom up in the views):
   - Front face colors (Z=0 row): read directly from FRONT view, left→right = X 0→max
   - Right face colors (X=max column): read from SIDE view, left→right = Z 0→max
   - Back face colors (Z=max row): read from BACK view, right→left = X 0→max
   - Interior: fill with the dominant body color for that body section
5. Use the HERO view to confirm 3D depth, arm positions, and overall proportions.

FEATURE MAPPING (CRITICAL — this is what makes the model recognizable):
- If the views show GLASSES → create a frame pattern on the eye layers using black/dark cells
- If the views show a HAT/CAP → add layers above the head with the hat's color
- If the views show ARMS holding something → extend grid width at arm layers
- If the views show a TAIL → extend grid depth at tail layers
- If the views show EARS/HORNS → add narrow layers at the top
- If the views show CLOTHING DETAILS (zipper, logo, belt) → use plate layers with color changes

IMPORTANT: The composite views are your EXACT blueprint. Match them as closely as possible.
Scale the model UP to fill the maximum grid space. Bigger = more detail = better match.
`
    : '';

  const themeNote = userPrompt ? `\nUSER NOTE: "${userPrompt}". Consider this when designing.\n` : '';

  return `You are a LEGO Master Builder and voxel artist. Convert the reference image into a 3D voxel color grid — think of it as building a detailed 3D pixel art sculpture that makes people say "wow!"
${viewsInstruction}${themeNote}
DETAIL LEVEL: ${detail.toUpperCase()}
GRID SIZE LIMIT: ${limits.label}
width (X) ≤ ${limits.maxW}, depth (Z) ≤ ${limits.maxD}, layers ≤ ${limits.maxLayers}

★ QUALITY TARGET: This should look like impressive 3D pixel/voxel art. Think Minecraft builds or LEGO Brickheadz — instantly recognizable, detailed, and satisfying. Every distinctive feature of the subject must be present.

${VOXEL_GRID_CORE_PROMPT}

${VOXEL_DESIGN_PROCESS}
${isRetry ? '' : `\n${VOXEL_WORKED_EXAMPLE}\n`}
═══════════════════════════════════════
FINAL CHECKLIST (verify before outputting)
═══════════════════════════════════════
1. SIZE: Use MOST of the grid. Aim for ${Math.ceil(limits.maxLayers * 0.8)}+ layers, width ~${limits.maxW}, depth ~${limits.maxD}. FILL the grid — bigger model = more detail = better.
2. SOLID: Every row of every layer must be FULLY FILLED between the leftmost and rightmost colored cell. No holes.
3. RECOGNIZABLE: Someone should look at this and immediately say "that's a [subject]!"
4. FEATURES: ALL distinctive features present — eyes, ears, horns, tail, mane, glasses, hat, accessories, clothing details, held items.
5. COLORS: Consistent palette. Contrasting detail colors. Match the reference image's actual colors.
6. PROPORTIONS: Match the composite views. Head-to-body ratio must be correct.
7. PLATES: Use heightType="plate" for detail layers. A good model has ~40-60% plate layers.
8. NO FLOATING: Every layer must overlap the layer below.

Return ONLY valid JSON matching the schema.`;
}

/**
 * Build the voxel grid prompt for the BUILD flow (inventory → LEGO).
 * The AI receives an inventory list and outputs a VoxelGrid using only available colors.
 */
export function buildVoxelBuildPrompt(
  difficulty: Difficulty,
  userPrompt: string,
  availableColors: { hex: string; name: string }[]
): string {
  const limits = BUILD_GRID_LIMITS[difficulty];

  const colorList = availableColors.map((c) => `  ${c.hex} (${c.name})`).join('\n');

  const creativeInstruction = userPrompt
    ? `BUILD TARGET: "${userPrompt}". The model MUST be instantly recognizable as this subject. Include ALL distinctive features.`
    : 'Choose a creative theme based on available colors. Surprise the user with a recognizable, impressive model.';

  const difficultyInstruction: Record<Difficulty, string> = {
    beginner: 'Simple but recognizable blocky model. Fill layers fully. Use most of the grid space. About 50-100 bricks when converted.',
    normal: 'Detailed, impressive model — aim for a "wow" effect. Use the full grid space with clear features and accessories. About 150-350 bricks when converted.',
    expert: 'Maximum detail and precision — museum-quality voxel sculpture. Use plates for fine detail layers, fill the full grid. About 350-700 bricks when converted.',
  };

  return `You are a LEGO Master Builder and voxel artist. Design an impressive 3D voxel sculpture using ONLY the colors available in the user's inventory. Create something that makes people say "wow!" — detailed, recognizable, and filling the grid space.

${creativeInstruction}
DIFFICULTY: ${difficulty.toUpperCase()}
${difficultyInstruction[difficulty]}
GRID SIZE LIMIT: ${limits.label}
width (X) ≤ ${limits.maxW}, depth (Z) ≤ ${limits.maxD}, layers ≤ ${limits.maxLayers}

AVAILABLE COLORS (use ONLY these hex values in the grid):
${colorList}

${VOXEL_GRID_CORE_PROMPT}

${VOXEL_DESIGN_PROCESS}

${VOXEL_WORKED_EXAMPLE}

CRITICAL RULES:
1. Use ONLY hex colors from the AVAILABLE COLORS list above. No other colors allowed.
2. EVERY cell inside the model outline MUST have a color — no empty holes.
3. The model must be recognizable as the requested subject.
4. Eyes = contrasting 1x1 cells on the front face (Z=0 row), symmetrically placed.
5. Use the most abundant colors for the largest areas (body, base).
6. Stay within grid limits: ${limits.maxW}×${limits.maxD}×${limits.maxLayers}. Use MOST of the space.
7. Layer footprints must overlap — no floating sections.
8. Use plate layers (~40-60% of total) for detail areas — eyes, mouth, belt, accessories.

Return ONLY valid JSON matching the schema.`;
}

export { DESIGN_GRID_LIMITS, BUILD_GRID_LIMITS };
