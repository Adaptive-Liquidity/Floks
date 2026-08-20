import { create } from "zustand";
import type { UiStoreState } from "../types";

export interface UiStoreActions {
  setCommandPaletteOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
  setInspectDrawerOpen: (open: boolean) => void;
  setEvidenceDrawerOpen: (open: boolean) => void;
  setSelectedGraphNodeId: (nodeId?: string) => void;
  setSelectedEvidenceId: (evidenceId?: string) => void;
  setSelectedTimelineEventId: (eventId?: string) => void;
  setReducedMotion: (value: boolean) => void;
  setLabelsVisible: (value: boolean) => void;
  resetUiState: () => void;
}

export type UiStore = UiStoreState & UiStoreActions;

export const createUiState = (): UiStoreState => ({
  commandPaletteOpen: false,
  notificationsOpen: false,
  inspectDrawerOpen: false,
  evidenceDrawerOpen: false,
  selectedGraphNodeId: undefined,
  selectedEvidenceId: undefined,
  selectedTimelineEventId: undefined,
  reducedMotion: false,
  labelsVisible: true,
});

export const useUiStore = create<UiStore>((set) => ({
  ...createUiState(),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
  setInspectDrawerOpen: (inspectDrawerOpen) => set({ inspectDrawerOpen }),
  setEvidenceDrawerOpen: (evidenceDrawerOpen) => set({ evidenceDrawerOpen }),
  setSelectedGraphNodeId: (selectedGraphNodeId) => set({ selectedGraphNodeId }),
  setSelectedEvidenceId: (selectedEvidenceId) => set({ selectedEvidenceId }),
  setSelectedTimelineEventId: (selectedTimelineEventId) => set({ selectedTimelineEventId }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setLabelsVisible: (labelsVisible) => set({ labelsVisible }),
  resetUiState: () => set(createUiState()),
}));
