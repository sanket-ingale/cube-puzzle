import { create } from 'zustand';
import type { NewRecord } from './stats';

interface PersonalBest {
  /** The latest new record(s), shown until dismissed. `id` changes with each celebration. */
  celebration: { id: number; records: NewRecord[] } | null;
  dismiss: () => void;
}

let nextId = 0;

export const usePersonalBest = create<PersonalBest>((set) => ({
  celebration: null,
  dismiss: () => set({ celebration: null }),
}));

export function celebrate(records: NewRecord[]) {
  usePersonalBest.setState({ celebration: { id: nextId++, records } });
}
