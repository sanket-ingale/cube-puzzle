import { canVibrate } from '../game/feedback';
import { Dialog } from './Dialog';
import { usePrefs, type Prefs, type ThemeChoice } from './prefs';
import { useUi } from './uiStore';

function Switch({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      className="setting-row"
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className="setting-text">
        <span className="setting-label">{label}</span>
        {description && <span className="setting-description">{description}</span>}
      </span>
      <span className="switch" aria-hidden="true" />
    </button>
  );
}

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Automatic' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const setOpen = useUi((s) => s.setSettingsOpen);
  const prefs = usePrefs();
  const toggle = (key: keyof Omit<Prefs, 'theme'>) => (on: boolean) => prefs.set(key, on);
  const vibration = canVibrate();

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Settings">
      <section className="help-section">
        <h3>Sound and touch</h3>
        <Switch id="setting-sound" label="Sounds" description="A click for each turn and a chime when solved." checked={prefs.sound} onChange={toggle('sound')} />
        <Switch
          id="setting-haptics"
          label="Vibration"
          description={vibration ? 'A light buzz for each of your turns.' : 'This device or browser doesn’t support vibration.'}
          checked={vibration && prefs.haptics}
          onChange={toggle('haptics')}
          disabled={!vibration}
        />
      </section>

      <section className="help-section">
        <h3>Accessibility</h3>
        <Switch
          id="setting-letters"
          label="Sticker letters"
          description="Marks every sticker with its colour’s initial: W, Y, G, B, R, O."
          checked={prefs.letters}
          onChange={toggle('letters')}
        />
        <Switch
          id="setting-contrast"
          label="High-contrast colours"
          description="Pulls red and orange, and green and blue, further apart."
          checked={prefs.highContrast}
          onChange={toggle('highContrast')}
        />
      </section>

      <section className="help-section">
        <h3>Appearance</h3>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {THEMES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={prefs.theme === value}
              onClick={() => prefs.set('theme', value)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="setting-description">Automatic follows your device’s light or dark setting.</p>
      </section>
    </Dialog>
  );
}
