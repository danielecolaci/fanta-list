import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ActiveFilter,
  PlayerFilters,
  emptyFilters,
  filtersFromParams,
  filtersToParams,
} from '../models/player-filters.model';
import { MACRO_ROLES, PlayerMacroRole, normalizeSearch } from '../models/player.model';
import { PlayersService } from './players.service';

const nameCollator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

@Injectable()
export class PlayersStore {
  private readonly source = inject(PlayersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly navigationMarker = {};
  private readonly state = signal<PlayerFilters>(
    filtersFromParams(this.route.snapshot.queryParamMap),
  );
  private readonly selectedMacroRole = computed(() => this.state().macroRole);
  private readonly searchIndex = computed(() =>
    this.source.players().map((player) => ({
      player,
      text: normalizeSearch(`${player.name} ${player.team}`),
    })),
  );

  readonly filters = this.state.asReadonly();
  readonly availableTeams = computed(() =>
    [...new Set(this.source.players().map((player) => player.team))].sort(nameCollator.compare),
  );
  readonly availableRoles = computed(() => {
    const macroRole = this.selectedMacroRole();
    const roles = new Set<string>();
    for (const player of this.source.players()) {
      if (macroRole === null || player.macroRole === macroRole) {
        player.roles.forEach((role) => roles.add(role));
      }
    }
    return [...roles].sort(nameCollator.compare);
  });

  readonly filteredPlayers = computed(() => {
    const filters = this.state();
    const search = normalizeSearch(filters.search);
    const roles = new Set(filters.roles);
    const teams = new Set(filters.teams);
    const result = this.searchIndex()
      .filter(({ player, text }) => {
        return (
          (!search || text.includes(search)) &&
          (filters.macroRole === null || player.macroRole === filters.macroRole) &&
          (roles.size === 0 || player.roles.some((role) => roles.has(role))) &&
          (teams.size === 0 || teams.has(player.team)) &&
          (filters.minFvm === null || player.fvm.value >= filters.minFvm) &&
          (filters.maxFvm === null || player.fvm.value <= filters.maxFvm) &&
          (filters.minQuotation === null || player.quotation.value >= filters.minQuotation) &&
          (filters.maxQuotation === null || player.quotation.value <= filters.maxQuotation)
        );
      })
      .map(({ player }) => player);

    switch (filters.sort) {
      case 'name-asc':
        return result.sort((a, b) => nameCollator.compare(a.name, b.name));
      case 'name-desc':
        return result.sort((a, b) => nameCollator.compare(b.name, a.name));
      case 'fvm-asc':
        return result.sort(
          (a, b) => a.fvm.value - b.fvm.value || nameCollator.compare(a.name, b.name),
        );
      case 'fvm-desc':
        return result.sort(
          (a, b) => b.fvm.value - a.fvm.value || nameCollator.compare(a.name, b.name),
        );
      case 'quotation-asc':
        return result.sort(
          (a, b) => a.quotation.value - b.quotation.value || nameCollator.compare(a.name, b.name),
        );
      case 'quotation-desc':
        return result.sort(
          (a, b) => b.quotation.value - a.quotation.value || nameCollator.compare(a.name, b.name),
        );
      default:
        return result;
    }
  });

  readonly activeFilters = computed<ActiveFilter[]>(() => {
    const filters = this.state();
    const chips: ActiveFilter[] = [];
    if (filters.search.trim())
      chips.push({ id: 'search', label: `Ricerca: ${filters.search.trim()}` });
    if (filters.macroRole) {
      chips.push({
        id: 'role',
        label:
          MACRO_ROLES.find((role) => role.value === filters.macroRole)?.label ?? filters.macroRole,
      });
    }
    for (const role of filters.roles) chips.push({ id: `role:${role}`, label: role });
    for (const team of filters.teams) chips.push({ id: `team:${team}`, label: team });
    if (filters.minFvm !== null) chips.push({ id: 'minFvm', label: `FVM ≥ ${filters.minFvm}` });
    if (filters.maxFvm !== null) chips.push({ id: 'maxFvm', label: `FVM ≤ ${filters.maxFvm}` });
    if (filters.minQuotation !== null)
      chips.push({ id: 'minQuotation', label: `Quot. ≥ ${filters.minQuotation}` });
    if (filters.maxQuotation !== null)
      chips.push({ id: 'maxQuotation', label: `Quot. ≤ ${filters.maxQuotation}` });
    return chips;
  });
  readonly activeFiltersCount = computed(() => this.activeFilters().length);
  readonly hasActiveFilters = computed(() => this.activeFiltersCount() > 0);
  readonly resultsCount = computed(() => this.filteredPlayers().length);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const next = filtersFromParams(params);
      const ownNavigation =
        this.router.getCurrentNavigation()?.extras.info === this.navigationMarker;
      // Rapid typing can cancel a previous navigation. Its intermediate URL must not replace newer input.
      if (
        ownNavigation &&
        JSON.stringify(filtersToParams(next)) !== JSON.stringify(filtersToParams(this.state()))
      ) {
        return;
      }
      if (JSON.stringify(filtersToParams(next)) !== JSON.stringify(filtersToParams(this.state()))) {
        this.state.set(next);
      }
    });
  }

  patchFilters(patch: Partial<PlayerFilters>): void {
    const next = { ...this.state(), ...patch };
    next.roles = [...new Set(next.roles)];
    next.teams = [...new Set(next.teams)];
    this.state.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filtersToParams(next),
      queryParamsHandling: 'merge',
      replaceUrl: true,
      info: this.navigationMarker,
    });
  }

  setMacroRole(macroRole: PlayerMacroRole | null): void {
    const available = new Set(
      this.source
        .players()
        .filter((player) => macroRole === null || player.macroRole === macroRole)
        .flatMap((player) => player.roles),
    );
    this.patchFilters({
      macroRole,
      roles: this.state().roles.filter((role) => available.has(role)),
    });
  }

  removeFilter(id: string): void {
    if (id === 'search') {
      this.patchFilters({ search: '' });
    } else if (id === 'role') {
      this.setMacroRole(null);
    } else if (id.startsWith('role:')) {
      this.patchFilters({ roles: this.state().roles.filter((role) => role !== id.slice(5)) });
    } else if (id.startsWith('team:')) {
      this.patchFilters({ teams: this.state().teams.filter((team) => team !== id.slice(5)) });
    } else if (
      id === 'minFvm' ||
      id === 'maxFvm' ||
      id === 'minQuotation' ||
      id === 'maxQuotation'
    ) {
      this.patchFilters({ [id]: null });
    }
  }

  resetFilters(): void {
    this.patchFilters(emptyFilters());
  }

  cycleSort(column: 'name' | 'fvm' | 'quotation'): void {
    const current = this.state().sort;
    if (column === 'name') {
      this.patchFilters({
        sort:
          current === 'name-asc' ? 'name-desc' : current === 'name-desc' ? 'original' : 'name-asc',
      });
      return;
    }
    this.patchFilters({
      sort:
        current === `${column}-desc`
          ? `${column}-asc`
          : current === `${column}-asc`
            ? 'original'
            : `${column}-desc`,
    });
  }
}
