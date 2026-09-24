import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPrefs } from './prefs';

const stub = (value: string | null) =>
  vi.stubGlobal('localStorage', { getItem: () => value, setItem: () => undefined });

describe('loadPrefs', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the defaults when nothing is saved', () => {
    stub(null);
    expect(loadPrefs()).toEqual({ sound: true, haptics: true, letters: false, highContrast: false, theme: 'system' });
  });

  it('keeps valid saved values and replaces invalid ones', () => {
    stub(JSON.stringify({ sound: false, letters: 'yes', theme: 'purple', highContrast: true }));
    expect(loadPrefs()).toMatchObject({ sound: false, letters: false, theme: 'system', highContrast: true });
  });

  it('survives unreadable storage', () => {
    stub('{not json');
    expect(loadPrefs().sound).toBe(true);
  });
});
