import { PlayerMacroRole } from '../models/player.model';

export const ROLE_LABELS: Record<PlayerMacroRole, string> = {
  P: 'Portiere',
  D: 'Difensore',
  C: 'Centrocampista',
  A: 'Attaccante',
};

export const ROLE_BADGES: Record<PlayerMacroRole, string> = {
  P: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  D: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  C: 'bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200',
  A: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
};
