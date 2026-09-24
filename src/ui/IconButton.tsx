import type { ComponentType, MouseEventHandler } from 'react';
import type { LucideProps } from 'lucide-react';

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
}

/**
 * An icon-only button. The label is its accessible name and, on devices that can hover, a
 * tooltip; touch screens rely on the help dialog's icon guide instead.
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
}: IconButtonProps) {
  const tip = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      className={['icon-button', primary && 'primary', busy && 'busy'].filter(Boolean).join(' ')}
      aria-label={label}
      aria-pressed={pressed}
      aria-busy={busy || undefined}
      data-tip={tip}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={20} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
