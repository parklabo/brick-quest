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

export const PROPORTION_PLANNING_PROMPT = `═══════════════════════════════════════
PROPORTION PLANNING (Do this BEFORE placing any bricks)
═══════════════════════════════════════
Follow these 5 steps to plan proportions before generating any brick coordinates:

STEP A — IDENTIFY SECTIONS (bottom to top):
  List each body section of the subject. Example for a character:
  feet → legs → body/torso → neck → head → hair/hat/ears
  Example for an animal:
  feet/paws → legs → body → neck → head → ears/horns

STEP B — ALLOCATE LAYERS PER SECTION:
  Assign a Y layer count to each section. Total should be 8-16 layers.
  Example character: feet=1 layer, legs=2 layers, body=4 layers, head=4 layers, top=1 layer = 12 layers
  Rule: the LARGEST section (body or head) gets the most layers.
  Use plates (0.4 height) for fine transitions between sections.

STEP C — DEFINE FOOTPRINT PER SECTION:
  Assign a width(X) × depth(Z) footprint for each section.
  Example: feet=2x2, legs=2x3, body=6x5, head=6x5, ears=1x1 extensions
  Rule: body and head are usually the widest. Legs are narrower. Feet extend slightly forward.

STEP D — CENTER ALIGNMENT:
  All sections must be centered on the same XZ center point.
  If body is 6 wide (X: 0-5, center=2.5) then head should also center at X=2.5.
  Legs should be symmetric around center. Appendages extend from edges.

STEP E — COLOR MAPPING:
  Assign the dominant color for each section.
  Example: feet=orange, legs=black, body=white(front)+black(sides), head=white(face)+black(back), eyes=black 1x1`;

export const SHAPE_USAGE_GUIDE_PROMPT = `═══════════════════════════════════════
SHAPE USAGE GUIDE — When to use each shape
═══════════════════════════════════════
GOLDEN RULE: interior = rectangular bricks ONLY. Slopes/curves = OUTER SURFACE edges ONLY.

| Shape         | When to use                                            | When NOT to use                  |
|---------------|--------------------------------------------------------|----------------------------------|
| rectangle     | All interior fill, walls, flat surfaces, structure      | Never wrong to use               |
| slope_*       | Outer edges to shape silhouette (head top, roof, nose)  | Interior fill, vertical walls    |
| curved_slope  | Smooth organic outer curves (forehead, belly curve)     | Interior fill, flat surfaces     |
| arch          | Curved OPENINGS (doorways, bridges, rainbow arcs, legs) | Vertical columns, solid walls    |
| cone          | Horns, tower tops, pointed tips, unicorn horn           | General structure                |
| round         | Eyes (1x1), buttons, cylindrical columns, dots          | Flat surfaces, structure fill    |
| plate_round   | Eye details, decorative dots, circular accents          | Structure fill                   |
| cheese_slope  | Tiny 1x1 detail transitions, eyebrows, small noses     | Large surfaces                   |
| dome          | Rounded tops, helmets, heads of animals                 | Flat areas                       |
| corner        | L-shaped corners where two walls meet                   | Straight runs                    |
| panel         | Thin vertical walls, side details, flat side surfaces   | Thick structural areas           |
| wedge_plate   | Wing shapes, angular flat details                       | Structural fill                  |

SLOPE PLACEMENT RULES:
- Slopes go on the OUTERMOST ring of a layer to shape the silhouette
- The layer BELOW a slope layer must be fully filled with rectangles
- Never stack slopes on slopes — alternate: rectangle layer → slope layer → rectangle layer
- Slopes face OUTWARD (toward the exterior of the model)`;

export const ARCHITECTURAL_PATTERNS_PROMPT = `═══════════════════════════════════════
ARCHITECTURAL PATTERNS — How to build common features
═══════════════════════════════════════

PATTERN 1 — ARCHES & RAINBOW CURVES:
  ✅ CORRECT: Use arch bricks spanning a gap between two support columns.
     Place support bricks on each side, then the arch brick spans across the opening.
  ❌ WRONG: Do NOT stack individual bricks vertically in a column to approximate a curve.
  Example (arch doorway): two 1x2 columns at X=0 and X=3, arch brick at Y=2.4 spanning X=0 to X=3.

PATTERN 2 — CURVED SURFACES (body, head):
  Build layer by layer, VARYING the footprint width at each layer.
  Bottom layers: full width (e.g., 6 studs). Middle layers: same or slightly wider. Top layers: taper inward.
  Add slopes/curved_slopes ONLY at the outer edges of tapering layers.
  Example (rounded head, front view at Z=0):
    Layer 0: 6 wide [R R R R R R]        — full rectangle fill
    Layer 1: 6 wide [R R R R R R]        — full rectangle fill
    Layer 2: 6 wide [S R R R R S]        — slopes at edges, rectangles inside
    Layer 3: 4 wide   [S R R S]          — narrower, slopes at edges
    Layer 4: 2 wide     [S S]            — top cap with slopes

PATTERN 3 — FACES & HEADS:
  Eyes: place TWO 1x1 round bricks (or plates) symmetrically at the same Y height on the FRONT face (lowest Z row of that layer).
  Eye spacing: typically 2-3 studs apart, centered on the head width.
  Nose: 1x1 brick centered between and below eyes (1 layer below, or same layer at Z+1).
  Mouth: 1x1 or 1x2 brick(s) below nose, different color.
  Ears: extend 1x1 bricks outward from the head at ear height (side columns).

PATTERN 4 — LEGS & FEET:
  Build as TWO SEPARATE columns below the body, symmetric around center X.
  Each leg: 1-2 studs wide, 2+ layers tall.
  Feet: extend 1 stud FORWARD (lower Z) from leg bottom, 1 layer tall.
  Gap between legs: at least 1 stud wide.
  The body layer above legs must span across BOTH legs for structural support.

PATTERN 5 — ARMS & APPENDAGES:
  Attach at SHOULDER HEIGHT (top of body section, before neck/head).
  Mount bricks at the LEFT and RIGHT edges of the body, extending outward.
  Arms: 1x1 or 1x2 bricks, 2-3 layers descending from shoulder.
  DO NOT leave arms floating — they must share at least 1 stud overlap with the body.

PATTERN 6 — TAILS, HORNS & ACCESSORIES:
  Tails: extend from the BACK of the body (highest Z). Use 1x1 bricks stepping outward.
  Horns: use cone shapes on top of head, or stack 1x1 bricks narrowing upward.
  Wings: use wedge_plates extending from the back/sides.
  ALL accessories must connect to the main body grid — NO floating parts.

PATTERN 7 — SMOOTH VERTICAL TRANSITIONS:
  For fine vertical resolution, mix plates (0.4h) with bricks (1.2h):
  - Use bricks for main structure layers (faster, fewer pieces)
  - Use plates where you need a subtle step (e.g., belt line, collar, chin)
  - 3 plates = 1 brick height (3 × 0.4 = 1.2)
  This gives you 3× finer vertical control in transition zones.`;

export const ADVANCED_WORKED_EXAMPLE_PROMPT = `═══════════════════════════════════════
COMPLETE WORKED EXAMPLE — Penguin (~45 bricks, 10 layers)
═══════════════════════════════════════
Subject: Penguin — black body, white belly, orange feet/beak, black/white eyes

PROPORTION PLAN:
  Sections: feet(1 layer) → body(5 layers) → head(3 layers) → top(1 layer)
  Footprints: feet=4x3, body=4x4, head=4x4, top=2x2
  Center: X=1.5 (even width=4 → center at 1.5), Z=1.5
  Colors: feet=orange, body sides=black, belly=white, head=black, face=white, eyes=black, beak=orange

LAYER 0 (y=0.0) — Orange feet, 4x3 footprint (X:0-3, Z:0-2):
  Grid:  [O O O O]   O=orange
         [O O O O]
         [O O O O]
  Tiling:
    step 1: 2x3 orange brick → x=0.5, y=0.0, z=1 (covers X:0-1, Z:0-2) — shape: rectangle
    step 2: 2x3 orange brick → x=2.5, y=0.0, z=1 (covers X:2-3, Z:0-2) — shape: rectangle
  CHECK: 2 bricks × 6 studs = 12 = 4×3 ✓

LAYER 1 (y=1.2) — Body base, 4x4, black sides + white center:
  Grid:  [K K K K]   K=black, W=white
         [K W W K]
         [K W W K]
         [K K K K]
  Tiling:
    step 3:  1x4 black brick → x=0, y=1.2, z=1.5 (covers X:0, Z:0-3) — left wall
    step 4:  1x4 black brick → x=3, y=1.2, z=1.5 (covers X:3, Z:0-3) — right wall
    step 5:  1x2 black brick → x=1.5, y=1.2, z=0 (covers X:1-2, Z:0)  — front row center
    step 6:  2x2 white brick → x=1.5, y=1.2, z=1.5 (covers X:1-2, Z:1-2) — belly
    step 7:  1x2 black brick → x=1.5, y=1.2, z=3 (covers X:1-2, Z:3) — back row center
  CHECK: 5 bricks, 4+4+2+4+2 = 16 = 4×4 ✓

LAYERS 2-4 (y=2.4, 3.6, 4.8) — Body, same pattern as Layer 1:
  Repeat the Layer 1 pattern with STAGGERED BONDS (offset joints by 1 stud each layer).
  steps 8-22: 15 more bricks following the same black-sides + white-belly pattern.

LAYER 5 (y=6.0) — Neck/transition, 4x4, all black:
  Grid:  [K K K K]
         [K K K K]
         [K K K K]
         [K K K K]
  Tiling:
    step 23: 2x4 black brick → x=0.5, y=6.0, z=1.5 (covers X:0-1, Z:0-3)
    step 24: 2x4 black brick → x=2.5, y=6.0, z=1.5 (covers X:2-3, Z:0-3)
  CHECK: 2 bricks × 8 = 16 ✓

LAYER 6 (y=7.2) — Head, 4x4, black sides + white face at front:
  Grid:  [K W W K]   ← white face at Z=0
         [K K K K]
         [K K K K]
         [K K K K]
  Tiling:
    step 25: 1x1 black brick → x=0, y=7.2, z=0
    step 26: 1x2 white brick → x=1.5, y=7.2, z=0 — face
    step 27: 1x1 black brick → x=3, y=7.2, z=0
    step 28: 2x3 black brick → x=0.5, y=7.2, z=2 (covers X:0-1, Z:1-3)
    step 29: 2x3 black brick → x=2.5, y=7.2, z=2 (covers X:2-3, Z:1-3)
  CHECK: 5 bricks, 1+2+1+6+6 = 16 ✓

LAYER 7 (y=8.4) — Eyes + beak layer:
  Grid:  [K E W E K] — wait, 4 wide, so:
  Grid:  [E W W E]   ← E=black 1x1 eyes, W=white face at Z=0
         [K O K K]   ← O=orange 1x1 beak at (1, Z=1) — WAIT, beak goes at front
  CORRECTED (beak is front-facing, so at Z=0):
  Grid Z=0: [E W W E]   eyes + face
  Grid Z=1: [K K K K]   black
  Grid Z=2: [K K K K]   black
  Grid Z=3: [K K K K]   black
  Tiling:
    step 30: 1x1 black round brick → x=0, y=8.4, z=0 — LEFT EYE, shape: round
    step 31: 1x1 white brick → x=1, y=8.4, z=0 — face
    step 32: 1x1 white brick → x=2, y=8.4, z=0 — face
    step 33: 1x1 black round brick → x=3, y=8.4, z=0 — RIGHT EYE, shape: round
    step 34: 2x3 black brick → x=0.5, y=8.4, z=2 (covers X:0-1, Z:1-3)
    step 35: 2x3 black brick → x=2.5, y=8.4, z=2 (covers X:2-3, Z:1-3)
  CHECK: 6 bricks, 1+1+1+1+6+6 = 16 ✓

LAYER 8 (y=9.6) — Beak + head, 4x4:
  Grid Z=0: [K O O K]   ← orange beak protrudes at front
  Grid Z=1-3: [K K K K]
  Tiling:
    step 36: 1x1 black brick → x=0, y=9.6, z=0
    step 37: 1x2 orange brick → x=1.5, y=9.6, z=0 — BEAK, shape: rectangle
    step 38: 1x1 black brick → x=3, y=9.6, z=0
    step 39: 2x3 black brick → x=0.5, y=9.6, z=2
    step 40: 2x3 black brick → x=2.5, y=9.6, z=2
  CHECK: 5 bricks ✓

LAYER 9 (y=10.8) — Top cap, 2x2 with slopes:
  Grid:  [S S]   S=black slope (facing outward)
         [S S]
  Tiling:
    step 41: 1x2 black slope_45 → x=0.5, y=10.8, z=0 — front slope
    step 42: 1x2 black slope_45 → x=0.5, y=10.8, z=1 — back slope (rotated 180°)
  Or use 2x2 black bricks if simpler. Slopes give a rounded head top.

TOTAL: ~42 bricks, 10 layers, recognizable penguin with:
  ✓ Orange feet at bottom
  ✓ Black body with white belly
  ✓ White face with black round eyes
  ✓ Orange beak
  ✓ Tapered top with slopes
  ✓ All bricks connected, no floating parts
  ✓ Every layer fully tiled, no gaps`;

export const CRITICAL_RULES_PROMPT = `═══════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════
1. ZERO GAPS: Every stud position within the layer footprint MUST be covered. Count the studs!
2. ZERO OVERLAPS: No two bricks on the same layer can cover the same stud position.
3. LAYER STACKING: Each layer must sit on the previous layer. Y increments: +1.2 for bricks, +0.4 for plates.
4. SOLID FROM ALL SIDES: Looking at the model from front, back, left, right — no holes visible.
5. SOLID INTERIOR: Each layer must be FULLY FILLED — not just the outer shell. Do NOT create hollow structures. Every stud position inside the footprint must have a brick, even if it is not visible from outside.
6. STAGGERED BONDS: Offset brick joints between adjacent layers like real brickwork. If layer N has a 2x4 brick starting at x=0, layer N+1 should start its bricks at x=1 or x=2 to overlap the seam. This prevents the model from splitting apart.
7. VIEW CROSS-REFERENCE: For each layer at height Y, check ALL views to determine the exact outline — front/back views define the X extent, side view defines the Z extent. The intersection of all views gives the true footprint for that layer.
8. SLOPES ON EXTERIOR ONLY: Slopes and curved shapes go on the OUTERMOST positions of a layer. Interior fill is ALWAYS rectangular bricks.
9. SECTION TRANSITIONS: When changing from one body section to another (e.g., legs→body, body→head), the wider section must fully cover the narrower section below it for structural support.
10. NO VERTICAL COLUMNS FOR CURVES: To build an arch or curve, use actual arch bricks or vary the footprint width across layers. NEVER stack individual bricks in a vertical column to approximate a curve.`;
