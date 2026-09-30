import { forwardRef } from 'react';
import type { LucideProps } from 'lucide-react';

/**
 * The 2D view's own icon: three overlapping circles, like its layer circles, so it can't be
 * mistaken for the round arrow of Reset.
 */
export const CirclesIcon = forwardRef<SVGSVGElement, LucideProps>(function CirclesIcon(
  { size = 24, strokeWidth = 2, color = 'currentColor', ...rest },
  ref,
) {
  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <circle cx="12" cy="8.2" r="5.6" />
      <circle cx="8.3" cy="14.6" r="5.6" />
      <circle cx="15.7" cy="14.6" r="5.6" />
    </svg>
  );
});
