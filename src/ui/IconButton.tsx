import type { ComponentType, MouseEventHandler } from 'react';
import type { LucideProps } from 'lucide-react';

export type TipPlacement = 'below' | 'above' | 'below-end' | 'above-end';

interface IconButtonProps {
  icon: ComponentType<LucideProps>;
  /** Read by screen readers and shown in the tooltip. */
  label: string;
  /** Keyboard shortcut shown in the tooltip, e.g. 'Space'. */
  shortcut?: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  /** For toggles: whether it's on. */
  pressed?: boolean;
  /** Emphasised style for the main action. */
  primary?: boolean;
  busy?: boolean;
  /**
   * press: a chunky key with an outline and a hard shadow (actions).
   * tray: flat, inside a shared outlined tray (groups of toggles and helpers).
   * flat: no outline at all (help and settings).
   */
  variant?: 'press' | 'tray' | 'flat';
  /** A visible label next to the icon, for the one main action. */
  text?: string;
  tip?: TipPlacement;
  /** For toggles that open a menu. */
  expanded?: boolean;
}

/**
 * An icon button. The label is its accessible name and, on devices that can hover, a tooltip;
 * touch screens rely on the help dialog's icon guide instead.
 */
export function IconButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  disabled,
  pressed,
  primary,
  busy,
  variant = 'press',
  text,
  tip = 'below',
  expanded,
}: IconButtonProps) {
  const tipText = shortcut ? `${label} (${shortcut})` : label;
  const classes = ['icon-button', variant, primary && 'primary', busy && 'busy', text && 'with-text'];
  return (
    <button
      type="button"
      className={classes.filter(Boolean).join(' ')}
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-busy={busy || undefined}
      data-tip={text && !shortcut ? undefined : tipText}
      data-tip-at={tip}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={20} strokeWidth={2.25} aria-hidden="true" />
      {text && <span className="button-text">{text}</span>}
    </button>
  );
}
