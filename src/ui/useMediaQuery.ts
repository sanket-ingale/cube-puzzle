import { useSyncExternalStore } from 'react';

/** Whether a CSS media query matches, kept up to date as the window changes. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

/** Phones and narrow windows, where the 3D and 2D views take turns instead of sharing. */
export const NARROW_SCREEN = '(max-width: 899px)';

/** Touch screens without a mouse: the turn keys become picture buttons, since there's no keyboard. */
export const TOUCH_SCREEN = '(hover: none) and (pointer: coarse)';
