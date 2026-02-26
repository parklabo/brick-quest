/** Object recognition metadata extracted from reference image before voxel generation */
export interface SubjectRecognition {
  /** What the subject is (e.g. "unicorn", "golden retriever", "Mario character") */
  subject: string;
  /** Category of subject */
  category: 'character' | 'animal' | 'vehicle' | 'building' | 'food' | 'object' | 'scene';
  /** Key visual features ordered by importance (e.g. ["rainbow mane", "golden horn", "white body"]) */
  keyFeatures: string[];
  /** Dominant colors mapped to closest LEGO hex (e.g. [{ hex: "#FFFFFF", area: "body" }]) */
  colorMap: { hex: string; area: string }[];
  /** Estimated proportions for LEGO model */
  proportions: {
    /** Approximate width:height ratio (e.g. 0.6 means width is 60% of height) */
    widthToHeight: number;
    /** Approximate depth:width ratio (e.g. 0.5 means depth is 50% of width) */
    depthToWidth: number;
  };
  /** Body sections from bottom to top (e.g. ["feet", "legs", "torso", "neck", "head", "ears"]) */
  bodySections: string[];
}
