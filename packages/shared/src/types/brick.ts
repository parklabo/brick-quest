export type BrickShape =
  | 'rectangle'
  | 'corner'
  | 'round'
  | 'slope_25'
  | 'slope_33'
  | 'slope_45'
  | 'slope_65'
  | 'slope_75'
  | 'slope_inverted'
  | 'curved_slope'
  | 'arch'
  | 'cone'
  | 'wedge_plate'
  | 'dome'
  | 'half_cylinder'
  | 'technic_beam';

export type BrickType = 'brick' | 'plate' | 'tile' | 'slope' | 'technic' | 'minifig' | 'other';

export interface DetectedPart {
  id: string;
  name: string;
  color: string;
  hexColor: string;
  count: number;
  type: BrickType;
  shape: BrickShape;
  dimensions: {
    width: number;
    length: number;
  };
  tags?: string[];
}

export interface ScanResult {
  parts: DetectedPart[];
  aiInsight: string;
}

export interface BuildStepBlock {
  stepId: number;
  partName: string;
  color: string;
  hexColor: string;
  type: BrickType;
  shape: BrickShape;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  size: { width: number; height: number; length: number };
  description: string;
}

export interface BuildPlan {
  title: string;
  description: string;
  lore: string;
  steps: BuildStepBlock[];
  agentIterations?: number;
}

export interface PhysicsCorrectionEntry {
  stepId: number;
  partName: string;
  originalPosition: { x: number; y: number; z: number };
  size: { width: number; height: number; length: number };
  action: 'dropped' | 'gravity_snapped' | 'nudged';
  reason: string;
}

export interface PhysicsValidationReport {
  inputCount: number;
  outputCount: number;
  droppedCount: number;
  gravitySnappedCount: number;
  nudgedCount: number;
  droppedPercentage: number;
  corrections: PhysicsCorrectionEntry[];
}

export interface PhysicsResult {
  steps: BuildStepBlock[];
  report: PhysicsValidationReport;
}

export type Difficulty = 'beginner' | 'normal' | 'expert';

/** Detail level for AI design generation */
export type DesignDetail = 'simple' | 'standard' | 'detailed';

/** A LEGO part required for a design (shopping list item) */
export interface RequiredPart {
  name: string;
  shape: BrickShape;
  type: BrickType;
  color: string;
  hexColor: string;
  dimensions: { width: number; length: number };
  quantity: number;
}

/** Storage path for the composite 2x2 view image generated in Step 1 */
export interface DesignViews {
  composite: string; // designs/{jobId}/views_composite.png
}

/** Result of the photo → LEGO design pipeline */
export interface DesignResult {
  buildPlan: BuildPlan;
  requiredParts: RequiredPart[];
  referenceDescription: string;
  /** Storage path for the AI-generated LEGO-style preview image */
  previewImageStoragePath?: string;
}
