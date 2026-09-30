import { create } from 'zustand';
import { DEFAULT_FRAME, type ViewFrame } from '../keys/frame';
import type { Axis } from '../cube/model';

const WIDE_SCREEN = '(min-width: 900px)';

const matches = (query: string) => {
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
};

interface UiState {
  /** Desktop: the 2D panel beside the cube. Phones: the 2D view in place of the 3D one. */
  circularOpen: boolean;
  helpOpen: boolean;
  historyOpen: boolean;
  settingsOpen: boolean;
  /** The corner view the camera is in (or gliding to). The turn keys and hints follow it. */
  viewFrame: ViewFrame;
  /** The camera has been moved away from that corner view. */
  viewMoved: boolean;
  /** Space is held, so the turn keys turn the other way. */
  spaceHeld: boolean;
  /** The on-screen reverse key is on (the touch-screen stand-in for holding Space). */
  reverseLatched: boolean;
  /** Bumped to ask the camera to glide back to the default view. */
  viewResetRequest: number;
  /**
   * A layer lit up on the cube: briefly when a turn key is pressed, or while a key is hovered
   * (`hold`), so it's clear which part a key turns.
   */
  flash: { axis: Axis; layer: -1 | 0 | 1; at: number; hold: boolean } | null;
  setFlash: (flash: UiState['flash']) => void;
  toggleCircular: () => void;
  setCircularOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setHistoryOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setViewMoved: (moved: boolean) => void;
  setViewFrame: (frame: ViewFrame) => void;
  setSpaceHeld: (held: boolean) => void;
  toggleReverse: () => void;
  requestViewReset: () => void;
}

export const useUi = create<UiState>((set) => ({
  circularOpen: matches(WIDE_SCREEN),
  helpOpen: false,
  historyOpen: false,
  settingsOpen: false,
  viewFrame: DEFAULT_FRAME,
  viewMoved: false,
  spaceHeld: false,
  reverseLatched: false,
  viewResetRequest: 0,
  flash: null,
  setFlash: (flash) => set({ flash }),
  toggleCircular: () => set((s) => ({ circularOpen: !s.circularOpen })),
  setCircularOpen: (circularOpen) => set({ circularOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setHistoryOpen: (historyOpen) => set({ historyOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setViewMoved: (viewMoved) => set({ viewMoved }),
  setViewFrame: (viewFrame) => set({ viewFrame }),
  setSpaceHeld: (spaceHeld) => set({ spaceHeld }),
  toggleReverse: () => set((s) => ({ reverseLatched: !s.reverseLatched })),
  requestViewReset: () => set((s) => ({ viewResetRequest: s.viewResetRequest + 1 })),
}));
