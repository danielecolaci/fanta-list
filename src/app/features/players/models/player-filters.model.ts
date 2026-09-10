import { ParamMap, Params } from '@angular/router';
import { PlayerMacroRole } from './player.model';

export type PlayerSort =
  | 'original'
  | 'name-asc'
  | 'name-desc'
  | 'fvm-asc'
  | 'fvm-desc'
  | 'quotation-asc'
  | 'quotation-desc';

export interface PlayerFilters {
  search: string;
  macroRole: PlayerMacroRole | null;
  roles: string[];
  teams: string[];
  minFvm: number | null;
  maxFvm: number | null;
  minQuotation: number | null;
  maxQuotation: number | null;
  sort: PlayerSort;
}

export interface ActiveFilter {
  id: string;
  label: string;
}

export const DEFAULT_FILTERS: PlayerFilters = {
  search: '',
  macroRole: null,
  roles: [],
  teams: [],
  minFvm: null,
  maxFvm: null,
  minQuotation: null,
  maxQuotation: null,
  sort: 'original',
};

export const SORT_OPTIONS: ReadonlyArray<{ value: PlayerSort; label: string }> = [
  { value: 'original', label: 'Ordine del listone' },
  { value: 'name-asc', label: 'Nome A–Z' },
  { value: 'name-desc', label: 'Nome Z–A' },
  { value: 'fvm-desc', label: 'FVM decrescente' },
  { value: 'fvm-asc', label: 'FVM crescente' },
  { value: 'quotation-desc', label: 'Quotazione decrescente' },
  { value: 'quotation-asc', label: 'Quotazione crescente' },
];

export function emptyFilters(): PlayerFilters {
  return { ...DEFAULT_FILTERS, roles: [], teams: [] };
}

function readNumber(value: string | null): number | null {
  if (value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function readList(params: ParamMap, key: string): string[] {
  return [
    ...new Set(
      params
        .getAll(key)
        .flatMap((value) => value.split(','))
        .map((value) => value.normalize('NFC').trim())
        .filter(Boolean),
    ),
  ];
}

export function filtersFromParams(params: ParamMap): PlayerFilters {
  const role = params.get('role');
  const sort = params.get('sort');
  return {
    search: (params.get('q') ?? '').trim(),
    macroRole: role === 'P' || role === 'D' || role === 'C' || role === 'A' ? role : null,
    roles: readList(params, 'roles'),
    teams: readList(params, 'team'),
    minFvm: readNumber(params.get('minFvm')),
    maxFvm: readNumber(params.get('maxFvm')),
    minQuotation: readNumber(params.get('minQuotation')),
    maxQuotation: readNumber(params.get('maxQuotation')),
    sort: SORT_OPTIONS.some((option) => option.value === sort)
      ? (sort as PlayerSort)
      : DEFAULT_FILTERS.sort,
  };
}

/** Null values remove stale keys when Angular merges the application's query parameters. */
export function filtersToParams(filters: PlayerFilters): Params {
  return {
    role: filters.macroRole,
    roles: filters.roles.length ? filters.roles.join(',') : null,
    team: filters.teams.length ? filters.teams.join(',') : null,
    q: filters.search.trim() || null,
    minFvm: filters.minFvm,
    maxFvm: filters.maxFvm,
    minQuotation: filters.minQuotation,
    maxQuotation: filters.maxQuotation,
    sort: filters.sort === DEFAULT_FILTERS.sort ? null : filters.sort,
  };
}
