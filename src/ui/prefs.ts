import { create } from 'zustand';

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface Prefs {
  sound: boolean;
  haptics: boolean;
  /** Letters on every sticker (W Y G B R O), for telling colours apart without colour. */
  letters: boolean;
  /** A palette with more contrast between red/orange and green/blue. */
  highContrast: boolean;
  theme: ThemeChoice;
}

const STORAGE_KEY = 'cube-puzzle:prefs:v1';
const DEFAULTS: Prefs = { sound: true, haptics: true, letters: false, highContrast: false, theme: 'system' };

/** Saved preferences, falling back to the defaults for anything missing or malformed. */
export function loadPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Prefs>;
    const pick = <K extends keyof Prefs>(key: K, valid: (v: unknown) => boolean): Prefs[K] =>
      valid(saved[key]) ? (saved[key] as Prefs[K]) : DEFAULTS[key];
    const isBool = (v: unknown) => typeof v === 'boolean';
    return {
      sound: pick('sound', isBool),
      haptics: pick('haptics', isBool),
      letters: pick('letters', isBool),
      highContrast: pick('highContrast', isBool),
      theme: pick('theme', (v) => v === 'system' || v === 'light' || v === 'dark'),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

interface PrefsStore extends Prefs {
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
}

export const usePrefs = create<PrefsStore>((set, get) => ({
  ...loadPrefs(),
  set: (key, value) => {
    set({ [key]: value } as Partial<Prefs>);
    const { set: _setter, ...prefs } = get();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Not saved; the setting lasts for this visit.
    }
  },
}));
