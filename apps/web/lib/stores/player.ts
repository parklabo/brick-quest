import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const PLAYER_MODEL_PRESETS = [
  { label: 'Knight', modelUrl: '/models/characters/knight.glb' },
  { label: 'Rogue', modelUrl: '/models/characters/rogue.glb' },
  { label: 'Mage', modelUrl: '/models/characters/mage.glb' },
  { label: 'Barbarian', modelUrl: '/models/characters/barbarian.glb' },
  { label: 'Rogue Hooded', modelUrl: '/models/characters/rogue-hooded.glb' },
] as const;

export const PLAYER_COLOR_PRESETS = [
  { label: 'Purple', hex: '#7c3aed' },
  { label: 'Blue', hex: '#2563eb' },
  { label: 'Red', hex: '#dc2626' },
  { label: 'Green', hex: '#16a34a' },
  { label: 'Orange', hex: '#ea580c' },
  { label: 'Pink', hex: '#db2777' },
  { label: 'Teal', hex: '#0d9488' },
  { label: 'Gold', hex: '#ca8a04' },
] as const;

interface PlayerState {
  modelUrl: string;
  bodyColor: string;
  updateModel: (modelUrl: string) => void;
  updateColor: (bodyColor: string) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      modelUrl: PLAYER_MODEL_PRESETS[0].modelUrl,
      bodyColor: PLAYER_COLOR_PRESETS[0].hex,
      updateModel: (modelUrl) => set({ modelUrl }),
      updateColor: (bodyColor) => set({ bodyColor }),
    }),
    {
      name: 'bq-player',
      version: 1,
    }
  )
);
