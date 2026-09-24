import { create } from 'zustand';

const HELP_SEEN_KEY = 'cube-puzzle:help-seen:v1';
const WIDE_SCREEN = '(min-width: 900px)';
const TOUCH_SCREEN = '(pointer: coarse)';

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
  /** The on-screen move buttons; shown by default on touch screens. */
  padOpen: boolean;
  helpOpen: boolean;
  historyOpen: boolean;
  settingsOpen: boolean;
  toggleCircular: () => void;
  togglePad: () => void;
  setHelpOpen: (open: boolean) => void;
  setHistoryOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  circularOpen: matches(WIDE_SCREEN),
  padOpen: matches(TOUCH_SCREEN),
  helpOpen: firstVisit(),
  historyOpen: false,
  settingsOpen: false,
  toggleCircular: () => set((s) => ({ circularOpen: !s.circularOpen })),
  togglePad: () => set((s) => ({ padOpen: !s.padOpen })),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setHistoryOpen: (historyOpen) => set({ historyOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}));
