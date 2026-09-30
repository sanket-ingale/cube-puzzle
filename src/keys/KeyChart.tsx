import { TURN_KEYS, type TurnKey } from './keymap';
import { SlicePicture } from './SlicePicture';

const GROUPS: { group: TurnKey['group']; title: string }[] = [
  { group: 'left', title: 'Left face columns, down' },
  { group: 'right', title: 'Right face columns, down' },
  { group: 'rows', title: 'Rows, to the right' },
];

/** Every turn key as a picture, for the help: what each one turns and which way. */
export function KeyChart({ letters }: { letters: boolean }) {
  return (
    <div className="key-chart">
      {GROUPS.map(({ group, title }) => (
        <div key={group} className="key-chart-group">
          <p className="key-chart-title">{title}</p>
          <ul className="key-chart-keys">
            {TURN_KEYS.filter((k) => k.group === group).map((k) => (
              <li key={k.code}>
                <span className="key-chart-picture" aria-hidden="true">
                  <SlicePicture turnKey={k} reversed={false} />
                </span>
                {letters && <kbd>{k.label}</kbd>}
                <span className="key-chart-part">{k.part}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
