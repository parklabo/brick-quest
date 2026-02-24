import { create } from 'zustand';

export type ZoneId = 'design' | 'mybrick';

interface WorkshopState {
  nearStation: string | null;
  showStationPrompt: boolean;
  activeZone: ZoneId | null;
  showNotice: boolean;
  showProfile: boolean;
  setNearStation: (station: string) => void;
  clearNearStation: () => void;
  openZone: (zone: ZoneId) => void;
  closeZone: () => void;
  openNotice: () => void;
  closeNotice: () => void;
  openProfile: () => void;
  closeProfile: () => void;
}

export const useWorkshopStore = create<WorkshopState>()((set) => ({
  nearStation: null,
  showStationPrompt: false,
  activeZone: null,
  showNotice: false,
  showProfile: false,
  setNearStation: (station) => set({ nearStation: station, showStationPrompt: true }),
  clearNearStation: () => set({ nearStation: null, showStationPrompt: false }),
  openZone: (zone) => set({ activeZone: zone }),
  closeZone: () => set({ activeZone: null }),
  openNotice: () => set({ showNotice: true }),
  closeNotice: () => set({ showNotice: false }),
  openProfile: () => set({ showProfile: true }),
  closeProfile: () => set({ showProfile: false }),
}));
