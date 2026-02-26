import type { DesignDetail } from '../types/brick.js';

/** Grid size limits by detail level (same as voxel-grid.ts) */
const DESIGN_GRID_LIMITS: Record<DesignDetail, { maxW: number; maxD: number; maxLayers: number; label: string }> = {
  simple: { maxW: 12, maxD: 12, maxLayers: 16, label: '12×12 base, up to 16 layers' },
  standard: { maxW: 20, maxD: 18, maxLayers: 28, label: '20×18 base, up to 28 layers' },
  detailed: { maxW: 28, maxD: 24, maxLayers: 36, label: '28×24 base, up to 36 layers' },
};

const BUILD_COMMANDS_DSL_REFERENCE = `═══════════════════════════════════════
BUILD COMMANDS DSL — OUTPUT FORMAT
═══════════════════════════════════════
You output a COMPACT LIST OF BUILD COMMANDS that are interpreted into a 3D voxel grid.

COORDINATE SYSTEM:
- x = left → right (0 = leftmost)
- y = bottom → top (0 = ground level)
- z = front → back (0 = front face)
- 1 unit = 1 stud on X/Z, 1 layer on Y

AVAILABLE COMMANDS (5 total):

1. FILL x y z w h d color
   Fill a rectangular box starting at (x,y,z) with width=w, height=h, depth=d.
   Example: FILL 2 0 1 8 3 6 #237841  → green box: x=2..9, y=0..2, z=1..6

2. SET x y z color
   Set a single voxel at (x,y,z).
   Example: SET 5 4 0 #000000  → black voxel at front face (eye)

3. DOME cx cy cz rx ry rz color
   Draw a dome (half-ellipsoid, upper half only) centered at (cx,cy,cz) with radii (rx,ry,rz).
   Only fills voxels where y >= cy. Ellipsoid equation: (dx/rx)² + (dy/ry)² + (dz/rz)² ≤ 1

   CRITICAL — ry controls the dome HEIGHT (number of layers).
   For a FLAT dome (turtle shell, car roof): ry should be SMALL, rx and rz should be LARGE.
   For a TALL dome (round head, sphere): ry ≈ rx ≈ rz.

4. TAPER x y z w1 d1 w2 d2 h color
   Draw a tapered box (wider at bottom, narrower at top).
   Bottom layer at y: width=w1, depth=d1. Top layer at y+h-1: width=w2, depth=d2.
   Each layer is centered relative to the bottom. Sizes interpolate linearly.
   Example: TAPER 2 0 2 12 8 6 4 10 #FF0000  → red pyramid-like shape

5. PLATE y1 [y2]
   Mark layer(s) as plate type (0.4 units tall instead of 1.2 for brick).
   Single layer: PLATE 5  → layer 5 is plate type
   Range: PLATE 10 14  → layers 10 through 14 are plate type
   Default: all layers are brick unless marked with PLATE.

EXECUTION RULES:
- Commands execute in ORDER — later commands OVERWRITE earlier ones in overlapping regions.
  Use this intentionally: FILL a body, then SET details on the surface.
- Out-of-bounds coordinates are silently clipped to the grid dimensions.
- Colors are LEGO hex values (e.g. #FF0000, #237841, #000000).

★★★ CRITICAL STRATEGY — READ THIS CAREFULLY ★★★

STEP 1 — ANALYZE PROPORTIONS FIRST:
  Look at the subject from the SIDE view. What is its HEIGHT:WIDTH:DEPTH ratio?
  - Turtle/car/boat → WIDE and FLAT: width=max, depth=large, totalLayers=SMALL
  - Person/tree/bottle → TALL and NARROW: width=medium, depth=small, totalLayers=max
  - House/cube/chest → CUBIC: width≈depth≈totalLayers
  The totalLayers MUST match the subject's natural height. Do NOT set totalLayers to the maximum for flat subjects!

STEP 2 — USE SHAPE COMMANDS (DOME, TAPER), NOT JUST FILL:
  ❌ WRONG: Using only FILL commands creates a RECTANGULAR BOX — nobody will recognize it!
  ✅ RIGHT: Use DOME for rounded parts (heads, shells, bodies), TAPER for narrowing parts (legs, necks).

  Almost every organic subject has curved parts. Use DOME for them:
  - Animal body/shell → DOME with large rx/rz, small ry (flat dome)
  - Round head → DOME with rx≈ry≈rz
  - Helmet/hat → DOME on top

  Only use FILL for genuinely flat/rectangular parts: legs, base plate, arms, flat surfaces.

STEP 3 — LAYER THE DETAILS:
  a) DOME or TAPER for the main body shape
  b) FILL for rectangular appendages (legs, arms, tail)
  c) FILL thin slices for surface patterns (overwrite the body surface)
  d) SET for small 1×1 details (eyes, nose, buttons)
  e) PLATE for detail-rich layers`;

const BUILD_COMMANDS_COMPOSITE_VIEWS = `═══════════════════════════════════════
COMPOSITE VIEWS — YOUR BLUEPRINT
═══════════════════════════════════════
You have a 2×2 grid image showing 4 views of the EXACT model you must recreate:
- Top-left: Hero 3/4 angle → overall 3D shape and proportions
- Top-right: FRONT view → face/front details, width, height
- Bottom-left: RIGHT SIDE view → profile silhouette, depth, height
- Bottom-right: BACK view → rear details

★ PROPORTION EXTRACTION (do this FIRST before writing any commands):
1. Look at the FRONT view. Measure the WIDTH:HEIGHT ratio.
   - If the subject is WIDER than it is TALL → it's a flat/wide subject (turtle, car, boat)
   - If the subject is TALLER than it is WIDE → it's a tall subject (person, tree, tower)
2. Look at the SIDE view. Measure DEPTH relative to HEIGHT.
3. Set width close to the max limit.
4. Calculate totalLayers from the HEIGHT:WIDTH ratio:
   - If height ≈ 40% of width (turtle): totalLayers ≈ 0.4 × width
   - If height ≈ 200% of width (person): totalLayers ≈ 2.0 × width (capped at max)
5. Set depth proportionally from the SIDE view.

SHAPE MAPPING:
- Rounded body/shell visible in views → use DOME command
- Tapering shape (wider at bottom, narrow at top) → use TAPER command
- Flat rectangular sections → use FILL command
- Small features (eyes, buttons) → use SET command`;

const BUILD_COMMANDS_COLOR_REFERENCE = `COLOR REFERENCE (standard LEGO hex):
#FFFFFF white, #000000 black, #FF0000 red, #B40000 dark red,
#0055BF blue, #003DA5 dark blue, #237841 green, #184632 dark green,
#FEC401 yellow, #F97B22 orange, #C870A0 pink, #A0A5A9 light gray,
#6C6E68 dark gray, #E4CD9E tan, #958A73 dark tan, #AA7D55 medium nougat,
#7C503A reddish brown, #D09168 nougat, #352100 dark brown, #75B5D4 medium azure,
#582A12 dark brown, #A5499B lavender`;

/**
 * Generate a worked example with coordinates scaled to the current detail level.
 * A turtle is used because it demonstrates DOME (shell), FILL (legs/head), SET (eyes),
 * and PLATE — all 5 commands in one example.
 */
function buildScaledWorkedExample(detail: DesignDetail): string {
  const lim = DESIGN_GRID_LIMITS[detail];

  // Turtle proportions: wide and flat (height ≈ 40% of width)
  const W = Math.round(lim.maxW * 0.9);
  const D = Math.round(lim.maxD * 0.83);
  const H = Math.max(6, Math.round(W * 0.45));

  // Shell dome — flat: large rx/rz, small ry
  const cx = Math.round(W / 2);
  const cz = Math.round(D / 2);
  const rx = Math.round(W * 0.42);
  const ry = Math.max(2, Math.round(H * 0.35));
  const rz = Math.round(D * 0.39);

  // Legs — 4 stumpy blocks at corners
  const legW = Math.max(2, Math.round(W * 0.14));
  const legD = Math.max(2, Math.round(D * 0.22));
  const legInX = Math.round(W * 0.17);
  const legInZ = Math.round(D * 0.12);
  const legRX = W - legInX - legW;
  const legBZ = D - legInZ - legD;

  // Head — protrudes from front
  const headW = Math.max(3, Math.round(W * 0.25));
  const headH = Math.max(2, Math.round(H * 0.33));
  const headX = Math.round((W - headW) / 2);
  const eyeY = 2 + headH;
  const eyeLX = headX + 1;
  const eyeRX = headX + headW - 2;

  // Pattern lines on shell
  const patY = Math.min(2 + ry - 1, H - 1);
  const patX1 = Math.round(W * 0.33);
  const patX2 = Math.round(W * 0.67);
  const patStripeW = W - 2 * legInX;

  // Tail
  const tailX = Math.round((W - 2) / 2);

  // Plate range
  const plateMid = Math.min(patY, H - 1);
  const plateEnd = Math.min(plateMid + 1, H - 1);

  return `═══════════════════════════════════════
WORKED EXAMPLE — Garden Tortoise (${detail} detail, grid ≤${lim.maxW}×${lim.maxD}×${lim.maxLayers})
═══════════════════════════════════════
PROPORTION ANALYSIS: A turtle is WIDE and FLAT. Height ≈ 40% of width.
→ width: ${W}, depth: ${D}, totalLayers: ${H}  (NOT ${lim.maxLayers} — turtle is short!)

Sections: legs(2 layers) → shell dome(${ry} layers) → head(${headH} layers) → tail
Palette: body=#237841 (green), shell=#E4CD9E (tan), pattern=#352100 (dark brown), eyes=#000000

commands: [
  // 1. Legs — 4 stumpy blocks at corners (rectangular → FILL)
  "FILL ${legInX} 0 ${legInZ} ${legW} 2 ${legD} #237841",
  "FILL ${legRX} 0 ${legInZ} ${legW} 2 ${legD} #237841",
  "FILL ${legInX} 0 ${legBZ} ${legW} 2 ${legD} #237841",
  "FILL ${legRX} 0 ${legBZ} ${legW} 2 ${legD} #237841",
  // 2. Shell — DOME (the key shape command!)
  //    rx=${rx} (wide), ry=${ry} (SHORT = flat dome!), rz=${rz} (deep)
  "DOME ${cx} 2 ${cz} ${rx} ${ry} ${rz} #E4CD9E",
  // 3. Shell pattern — thin slices overwrite dome surface
  "FILL ${legInX} ${patY} ${cz} ${patStripeW} 1 1 #352100",
  "FILL ${patX1} 2 ${legInZ} 1 ${ry} ${D - 2 * legInZ} #352100",
  "FILL ${patX2} 2 ${legInZ} 1 ${ry} ${D - 2 * legInZ} #352100",
  // 4. Head — forward protrusion (FILL)
  "FILL ${headX} 2 0 ${headW} ${headH} 3 #237841",
  // 5. Eyes — single voxels (SET)
  "SET ${eyeLX} ${eyeY} 0 #000000",
  "SET ${eyeRX} ${eyeY} 0 #000000",
  // 6. Tail — small block at back
  "FILL ${tailX} 2 ${D - 1} 2 1 1 #237841",
  // 7. Plate layers for detail
  "PLATE 0 1",
  "PLATE ${plateMid} ${plateEnd}"
]

KEY POINT: DOME ry=${ry} → flat shell (only ${ry} layers tall).
If ry=${rx}, the shell would be a tall sphere — WRONG for a turtle!
totalLayers=${H} (not ${lim.maxLayers}) because turtles are SHORT.
Result: ~20 commands ≈ 600 tokens → recognizable 3D tortoise.`;
}

/**
 * Build the prompt for the BUILD COMMANDS DSL strategy.
 * Much shorter than the voxel-grid prompt (~1500 tokens vs ~4000).
 * The AI outputs a compact command list instead of a full 3D color grid.
 */
export function buildCommandsDesignPrompt(
  detail: DesignDetail,
  userPrompt: string,
  hasCompositeView: boolean,
  isRetry = false
): string {
  const limits = DESIGN_GRID_LIMITS[detail];

  const viewsSection = hasCompositeView ? `\n${BUILD_COMMANDS_COMPOSITE_VIEWS}\n` : '';
  const themeNote = userPrompt ? `\nUSER NOTE: "${userPrompt}". Consider this when designing.\n` : '';

  return `You are a LEGO Master Builder. Convert the reference into a 3D LEGO model using BUILD COMMANDS.
${viewsSection}${themeNote}
DETAIL LEVEL: ${detail.toUpperCase()}
GRID LIMITS: width (X) ≤ ${limits.maxW}, depth (Z) ≤ ${limits.maxD}, layers (Y) ≤ ${limits.maxLayers}
NOTE: These are MAXIMUM limits, NOT targets. Use totalLayers that matches the subject's proportions.

★ QUALITY TARGET: Impressive 3D voxel sculpture — instantly recognizable with ALL distinctive features. Think Minecraft builds or LEGO Brickheadz.

${BUILD_COMMANDS_DSL_REFERENCE}

${BUILD_COMMANDS_COLOR_REFERENCE}

STRUCTURAL RULES (CRITICAL):
1. PROPORTIONS FIRST: Analyze the subject's shape BEFORE writing commands. totalLayers MUST match the subject's natural height. Wide/flat subjects (turtle, car) → few layers. Tall subjects (person, tree) → many layers.
2. USE DOME/TAPER: Almost every organic subject has curved parts. DOME for round shapes, TAPER for narrowing shapes. FILL-only builds look like ugly rectangular boxes.
3. WIDTH/DEPTH: Use most of the available space horizontally (width and depth close to limits).
4. FRONT FACE IS KEY: Z=0 is the front. Put the most detail here (face, eyes, chest details).
5. ALL FEATURES: Include EVERY distinctive feature — eyes, ears, tail, horns, glasses, hat, accessories.
6. SOLID: No hollow interiors. Overlapping commands ensure solidity.
7. USE PLATES: Mark detail-rich layers as PLATE for 3× vertical resolution.
${isRetry ? '' : `\n${buildScaledWorkedExample(detail)}\n`}
═══════════════════════════════════════
FINAL CHECKLIST
═══════════════════════════════════════
1. PROPORTIONS: Does totalLayers reflect the subject's actual shape? Measure HEIGHT:WIDTH from the views and calculate. A flat subject (turtle, car) needs far fewer layers than a tall one (person, tree). Never default to max layers.
2. SHAPE: Did you use DOME for rounded parts? (If you only used FILL, your model is a rectangular box — redo it!)
3. RECOGNIZABLE: Someone should immediately say "that's a [subject]!"
4. FEATURES: ALL distinctive features present — eyes, ears, appendages, etc.
5. COLORS: Consistent LEGO hex palette matching the reference.
6. WIDTH/DEPTH: Using most of the horizontal grid space (close to ${limits.maxW}×${limits.maxD}).
7. PLATES: Detail layers marked as PLATE.

Return ONLY valid JSON matching the schema.`;
}

export { DESIGN_GRID_LIMITS as BUILD_COMMANDS_GRID_LIMITS };
