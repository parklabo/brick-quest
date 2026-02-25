import { create } from 'zustand';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import type { BuildStepBlock, BuildPlan, VoxelGrid } from '@brick-quest/shared';

export interface PlacedBrick extends BuildStepBlock {
  instanceId: string;
}

interface WorkspaceStore {
  // Build plan loaded into workspace
  plan: BuildPlan | null;
  setPlan: (plan: BuildPlan | null) => void;

  // Placed bricks (from plan steps or manually placed)
  placedBricks: PlacedBrick[];
  setPlacedBricks: (bricks: PlacedBrick[]) => void;
  addBrick: (brick: PlacedBrick) => void;
  removeBrick: (instanceId: string) => void;
  updateBrickPosition: (instanceId: string, position: { x: number; y: number; z: number }) => void;

  // Selection
  selectedBrickId: string | null;
  selectBrick: (instanceId: string | null) => void;

  // Hovered brick
  hoveredBrickId: string | null;
  setHoveredBrick: (instanceId: string | null) => void;

  // Camera focus target
  cameraTarget: { x: number; y: number; z: number };
  setCameraTarget: (target: { x: number; y: number; z: number }) => void;

  // Computed model center (for auto-centering in 3D view)
  modelCenter: { x: number; y: number; z: number };
  modelRadius: number;

  // View step (for step-by-step viewing)
  currentStep: number;
  setCurrentStep: (step: number) => void;

  // Mode
  mode: 'view' | 'edit';
  setMode: (mode: 'view' | 'edit') => void;

  // View mode: bricks (default) or voxels (raw AI output)
  viewMode: 'bricks' | 'voxels';
  setViewMode: (viewMode: 'bricks' | 'voxels') => void;

  // Voxel grid from AI (for voxel debug view)
  voxelGrid: VoxelGrid | null;
  voxelGridPath: string | null;
  voxelGridLoading: boolean;
  loadVoxelGrid: () => Promise<void>;

  // Where to navigate when pressing Back in workspace
  returnPath: string;

  // Source job tracking (for gallery highlight)
  sourceJobId: string | null;
  sourceJobType: 'build' | 'design' | null;

  // Load plan into workspace
  loadPlan: (plan: BuildPlan, returnPath?: string, sourceJobId?: string, sourceJobType?: 'build' | 'design', voxelGridPath?: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => ({
  plan: null,
  setPlan: (plan) => set({ plan }),

  placedBricks: [],
  setPlacedBricks: (bricks) => set({ placedBricks: bricks }),
  addBrick: (brick) => set({ placedBricks: [...get().placedBricks, brick] }),
  removeBrick: (instanceId) => set({ placedBricks: get().placedBricks.filter((b) => b.instanceId !== instanceId) }),
  updateBrickPosition: (instanceId, position) =>
    set({
      placedBricks: get().placedBricks.map((b) => (b.instanceId === instanceId ? { ...b, position } : b)),
    }),

  selectedBrickId: null,
  selectBrick: (instanceId) => set({ selectedBrickId: instanceId }),

  hoveredBrickId: null,
  setHoveredBrick: (instanceId) => set({ hoveredBrickId: instanceId }),

  cameraTarget: { x: 0, y: 0, z: 0 },
  setCameraTarget: (target) => set({ cameraTarget: target }),

  modelCenter: { x: 0, y: 0, z: 0 },
  modelRadius: 10,

  currentStep: -1,
  setCurrentStep: (step) => set({ currentStep: step }),

  mode: 'view',
  setMode: (mode) => set({ mode }),

  viewMode: 'bricks',
  setViewMode: (viewMode) => set({ viewMode }),

  voxelGrid: null,
  voxelGridPath: null,
  voxelGridLoading: false,
  loadVoxelGrid: async () => {
    const { voxelGrid, voxelGridPath, voxelGridLoading } = get();
    if (voxelGrid || !voxelGridPath || voxelGridLoading) return;
    set({ voxelGridLoading: true });
    try {
      const url = await getDownloadURL(ref(storage, voxelGridPath));
      const response = await fetch(url);
      const data: VoxelGrid = await response.json();
      set({ voxelGrid: data, voxelGridLoading: false });
    } catch (e) {
      console.error('Failed to load voxel grid:', e);
      set({ voxelGridLoading: false });
    }
  },

  returnPath: '/home',

  sourceJobId: null,
  sourceJobType: null,

  loadPlan: (plan, returnPath, sourceJobId, sourceJobType, voxelGridPath) => {
    const bricks: PlacedBrick[] = plan.steps.map((step, idx) => ({
      ...step,
      instanceId: `brick-${idx}-${step.stepId}`,
    }));

    // Compute model bounding box center for auto-centering in 3D view
    let minX = Infinity, maxX = -Infinity, maxY = 0, minZ = Infinity, maxZ = -Infinity;
    for (const step of plan.steps) {
      const halfW = step.size.width / 2;
      const halfL = step.size.length / 2;
      minX = Math.min(minX, step.position.x - halfW);
      maxX = Math.max(maxX, step.position.x + halfW);
      minZ = Math.min(minZ, step.position.z - halfL);
      maxZ = Math.max(maxZ, step.position.z + halfL);
      maxY = Math.max(maxY, step.position.y + step.size.height);
    }
    const hasSteps = plan.steps.length > 0;
    const modelCenter = hasSteps
      ? { x: (minX + maxX) / 2, y: maxY / 2, z: (minZ + maxZ) / 2 }
      : { x: 0, y: 0, z: 0 };
    const modelRadius = hasSteps
      ? Math.max(maxX - minX, maxZ - minZ, maxY) * 0.75
      : 10;

    set({
      plan,
      placedBricks: bricks,
      modelCenter,
      modelRadius,
      currentStep: 0,
      selectedBrickId: null,
      mode: 'view',
      viewMode: 'bricks',
      voxelGrid: plan.voxelGrid ?? null,
      voxelGridPath: voxelGridPath ?? null,
      voxelGridLoading: false,
      returnPath: returnPath ?? '/home',
      sourceJobId: sourceJobId ?? null,
      sourceJobType: sourceJobType ?? null,
    });
  },
}));
