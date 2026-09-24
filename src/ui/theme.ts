import { useEffect, useSyncExternalStore } from 'react';
import { usePrefs } from './prefs';

export type Theme = 'light' | 'dark';

const root = () => document.documentElement;
/** Whatever the host page (e.g. the artifact viewer) set before the app touched it. */
const hostTheme = typeof document !== 'undefined' ? root().getAttribute('data-theme') : null;
const LIGHT_QUERY = '(prefers-color-scheme: light)';

/** The theme showing right now: an explicit data-theme on <html>, otherwise the device's. */
function currentTheme(): Theme {
  const attribute = root().getAttribute('data-theme');
  if (attribute === 'light' || attribute === 'dark') return attribute;
  return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(LIGHT_QUERY);
  media.addEventListener('change', onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(root(), { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    media.removeEventListener('change', onChange);
    observer.disconnect();
  };
}

/** The resolved theme, updating when the device, the host page or the setting changes it. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme);
}

/**
 * Applies the Appearance setting. Light or Dark sets data-theme on <html>; Automatic hands
 * control back to the host page's own choice, or to the device when there is none.
 */
export function useThemeSetting() {
  const choice = usePrefs((s) => s.theme);
  useEffect(() => {
    const el = root();
    if (choice === 'system') {
      if (hostTheme) el.setAttribute('data-theme', hostTheme);
      else el.removeAttribute('data-theme');
    } else {
      el.setAttribute('data-theme', choice);
    }
  }, [choice]);
}

/** Colours the 3D scene needs, which CSS can't reach. */
export const SCENE_COLOURS: Record<Theme, { background: string; guide: string }> = {
  dark: { background: '#1b1d23', guide: '#facc15' },
  light: { background: '#e9ebf0', guide: '#d97706' },
};
