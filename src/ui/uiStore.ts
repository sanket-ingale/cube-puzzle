import { create } from 'zustand';

const HELP_SEEN_KEY = 'cube-puzzle:help-seen:v1';
const WIDE_SCREEN = '(min-width: 900px)';

const matches = (query: string) => {
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
};

function firstVisit(): boolean {
  try {
    if (localStorage.getItem(HELP_SEEN_KEY)) return false;
    localStorage.setItem(HELP_SEEN_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

interface UiState {
  /** Desktop: the 2D panel beside the cube. Phones: the 2D view in place of the 3D one. */
  circularOpen: boolean;
  helpOpen: boolean;
  historyOpen: boolean;
  settingsOpen: boolean;
  /** The camera has been moved away from the corner view the turn keys are laid out for. */
  viewMoved: boolean;
  /** Space is held, so the turn keys turn the other way. */
  spaceHeld: boolean;
  /** The on-screen reverse key is on (the touch-screen stand-in for holding Space). */
  reverseLatched: boolean;
  /** Bumped to ask the camera to glide back to the default view. */
  viewResetRequest: number;
  toggleCircular: () => void;
  setCircularOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setHistoryOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setViewMoved: (moved: boolean) => void;
  setSpaceHeld: (held: boolean) => void;
  toggleReverse: () => void;
  requestViewReset: () => void;
}

export const useUi = create<UiState>((set) => ({
  circularOpen: matches(WIDE_SCREEN),
  helpOpen: firstVisit(),
  historyOpen: false,
  settingsOpen: false,
  viewMoved: false,
  spaceHeld: false,
  reverseLatched: false,
  viewResetRequest: 0,
  toggleCircular: () => set((s) => ({ circularOpen: !s.circularOpen })),
  setCircularOpen: (circularOpen) => set({ circularOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setHistoryOpen: (historyOpen) => set({ historyOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setViewMoved: (viewMoved) => set({ viewMoved }),
  setSpaceHeld: (spaceHeld) => set({ spaceHeld }),
  toggleReverse: () => set((s) => ({ reverseLatched: !s.reverseLatched })),
  requestViewReset: () => set((s) => ({ viewResetRequest: s.viewResetRequest + 1 })),
}));
