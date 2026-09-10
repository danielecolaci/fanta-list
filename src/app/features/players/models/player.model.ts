export type PlayerMacroRole = 'P' | 'D' | 'C' | 'A';

export interface PlayerValue {
  value: number;
  secondaryValue: number | null;
}

export interface Player {
  id: string;
  originalIndex: number;
  name: string;
  team: string;
  macroRole: PlayerMacroRole;
  roles: string[];
  fvm: PlayerValue;
  quotation: PlayerValue;
}

export const MACRO_ROLES: ReadonlyArray<{
  value: PlayerMacroRole;
  label: string;
  singular: string;
}> = [
  { value: 'P', label: 'Portieri', singular: 'Portiere' },
  { value: 'D', label: 'Difensori', singular: 'Difensore' },
  { value: 'C', label: 'Centrocampisti', singular: 'Centrocampista' },
  { value: 'A', label: 'Attaccanti', singular: 'Attaccante' }
];

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('it')
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isPlayerValue(value: unknown): value is PlayerValue {
  return (
    isRecord(value) &&
    isNumber(value['value']) &&
    (value['secondaryValue'] === null || isNumber(value['secondaryValue']))
  );
}

/** Validate the complete static dataset: a malformed row must never disappear silently. */
export function parsePlayers(data: unknown): Player[] {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Il dataset deve contenere almeno un calciatore.');
  }

  const identifiers = new Set<string>();
  for (const [index, row] of data.entries()) {
    if (
      !isRecord(row) ||
      !isNonEmptyString(row['id']) ||
      !isNonEmptyString(row['name']) ||
      !isNonEmptyString(row['team']) ||
      !Number.isInteger(row['originalIndex']) ||
      (row['originalIndex'] as number) < 1 ||
      !MACRO_ROLES.some((role) => role.value === row['macroRole']) ||
      !Array.isArray(row['roles']) ||
      row['roles'].length === 0 ||
      !row['roles'].every(isNonEmptyString) ||
      !isPlayerValue(row['fvm']) ||
      !isPlayerValue(row['quotation'])
    ) {
      throw new Error(`Dati del calciatore non validi alla riga ${index + 1}.`);
    }

    if (identifiers.has(row['id'])) {
      throw new Error(`Identificatore duplicato alla riga ${index + 1}: ${row['id']}.`);
    }
    identifiers.add(row['id']);
  }

  return data as Player[];
}
