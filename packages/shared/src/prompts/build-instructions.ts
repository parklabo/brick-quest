// Shared prompt fragments for LEGO build instruction generation.
// Used by both geminiBuild and geminiDesign services.

export const COORDINATE_SYSTEM_PROMPT = `═══════════════════════════════════════
COORDINATE SYSTEM
═══════════════════════════════════════
- X axis = left-right, Z axis = front-back, Y axis = up
- 1 stud = 1 unit on X and Z
- Y value = BOTTOM of the brick
- Brick height = 1.2 units, Plate/tile height = 0.4 units
- Position = CENTER of the brick

POSITION RULES (center-based):
  Even dimension → x or z ends in .5 (examples: 0.5, 1.5, 2.5)
  Odd dimension  → x or z is integer (examples: 0, 1, 2, 3)

COVERAGE: a brick at position (px, pz) with size WxL covers:
  X range: [px - W/2, px + W/2]
  Z range: [pz - L/2, pz + L/2]`;

export const CRITICAL_RULES_PROMPT = `═══════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════
1. ZERO GAPS: Every stud position within the layer footprint MUST be covered. Count the studs!
2. ZERO OVERLAPS: No two bricks on the same layer can cover the same stud position.
3. LAYER STACKING: Each layer must sit on the previous layer. Y increments: +1.2 for bricks, +0.4 for plates.
4. SOLID FROM ALL SIDES: Looking at the model from front, back, left, right — no holes visible.`;
