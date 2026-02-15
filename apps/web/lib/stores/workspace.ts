import { create } from 'zustand';
import type { BuildStepBlock, BuildPlan } from '@brick-quest/shared';

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

  // View step (for step-by-step viewing)
  currentStep: number;
  setCurrentStep: (step: number) => void;

  // Mode
  mode: 'view' | 'edit';
  setMode: (mode: 'view' | 'edit') => void;

  // Load plan into workspace
  loadPlan: (plan: BuildPlan) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => ({
  plan: null,
  setPlan: (plan) => set({ plan }),

  placedBricks: [],
  setPlacedBricks: (bricks) => set({ placedBricks: bricks }),
  addBrick: (brick) => set({ placedBricks: [...get().placedBricks, brick] }),
  removeBrick: (instanceId) =>
    set({ placedBricks: get().placedBricks.filter((b) => b.instanceId !== instanceId) }),
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

  currentStep: -1,
  setCurrentStep: (step) => set({ currentStep: step }),

  mode: 'view',
  setMode: (mode) => set({ mode }),

  loadPlan: (plan) => {
    const bricks: PlacedBrick[] = plan.steps.map((step, idx) => ({
      ...step,
      instanceId: `brick-${idx}-${step.stepId}`,
    }));
    set({
      plan,
      placedBricks: bricks,
      currentStep: 0,
      selectedBrickId: null,
      mode: 'view',
    });
  },
}));
