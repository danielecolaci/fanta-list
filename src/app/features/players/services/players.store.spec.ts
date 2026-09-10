import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Navigation, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Player } from '../models/player.model';
import { PlayersService } from './players.service';
import { PlayersStore } from './players.store';

const players: Player[] = [
  {
    id: 'P-one',
    originalIndex: 1,
    name: 'Portiere',
    team: 'Inter',
    macroRole: 'P',
    roles: ['Por'],
    fvm: { value: 10, secondaryValue: 100 },
    quotation: { value: 8, secondaryValue: 5 },
  },
  {
    id: 'D-one',
    originalIndex: 1,
    name: 'Nicolò',
    team: 'Roma',
    macroRole: 'D',
    roles: ['Dc', 'Do'],
    fvm: { value: 50, secondaryValue: 1 },
    quotation: { value: 20, secondaryValue: 2 },
  },
  {
    id: 'A-one',
    originalIndex: 1,
    name: 'Martínez',
    team: 'Inter',
    macroRole: 'A',
    roles: ['Pc'],
    fvm: { value: 400, secondaryValue: 5 },
    quotation: { value: 40, secondaryValue: 1 },
  },
  {
    id: 'A-two',
    originalIndex: 2,
    name: 'Attaccante',
    team: 'Roma',
    macroRole: 'A',
    roles: ['W', 'A'],
    fvm: { value: 100, secondaryValue: 600 },
    quotation: { value: 10, secondaryValue: 50 },
  },
];

describe('PlayersStore', () => {
  let store: PlayersStore;
  let router: jasmine.SpyObj<Router>;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    query = new BehaviorSubject(convertToParamMap({}));
    router = jasmine.createSpyObj<Router>('Router', ['navigate', 'getCurrentNavigation']);
    router.navigate.and.resolveTo(true);
    router.getCurrentNavigation.and.returnValue(null);
    TestBed.configureTestingModule({
      providers: [
        PlayersStore,
        { provide: PlayersService, useValue: { players: signal(players) } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: query.value },
            queryParamMap: query.asObservable(),
          },
        },
        { provide: Router, useValue: router },
      ],
    });
    store = TestBed.inject(PlayersStore);
  });

  it('searches names and teams ignoring accents, casing and surrounding spaces', () => {
    store.patchFilters({ search: '  NICOLO  ' });
    expect(store.filteredPlayers().map((player) => player.id)).toEqual(['D-one']);
    store.patchFilters({ search: 'inter' });
    expect(store.resultsCount()).toBe(2);
  });

  it('combines filter groups with AND and multiple subroles with OR', () => {
    store.patchFilters({
      macroRole: 'A',
      roles: ['Pc', 'W'],
      teams: ['Inter', 'Roma'],
      minFvm: 150,
      maxQuotation: 40,
    });
    expect(store.filteredPlayers().map((player) => player.id)).toEqual(['A-one']);
  });

  it('filters and sorts primary values without mutating source order', () => {
    store.patchFilters({ sort: 'fvm-desc' });
    expect(store.filteredPlayers().map((player) => player.id)).toEqual([
      'A-one',
      'A-two',
      'D-one',
      'P-one',
    ]);
    store.patchFilters({ sort: 'original' });
    expect(store.filteredPlayers().map((player) => player.id)).toEqual(
      players.map((player) => player.id),
    );
    store.patchFilters({ minQuotation: 15 });
    expect(store.filteredPlayers().map((player) => player.id)).toEqual(['D-one', 'A-one']);
  });

  it('derives available roles and clears incompatible subroles on macro change', () => {
    store.patchFilters({ roles: ['Pc', 'Dc'] });
    store.setMacroRole('A');
    expect(store.filters().roles).toEqual(['Pc']);
    expect(store.availableRoles()).toEqual(['A', 'Pc', 'W']);
    expect(store.availableTeams()).toEqual(['Inter', 'Roma']);
  });

  it('restores URL navigation without causing a navigation loop', () => {
    query.next(convertToParamMap({ role: 'A', roles: 'Pc', team: 'Inter', sort: 'fvm-desc' }));
    expect(store.filteredPlayers().map((player) => player.id)).toEqual(['A-one']);
    expect(router.navigate).not.toHaveBeenCalled();
    query.next(convertToParamMap({ q: 'nicolo' }));
    expect(store.filteredPlayers().map((player) => player.id)).toEqual(['D-one']);
  });

  it('writes shareable parameters using replaceUrl', () => {
    store.patchFilters({ search: 'Martinez', teams: ['Inter'] });
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        replaceUrl: true,
        queryParams: jasmine.objectContaining({ q: 'Martinez', team: 'Inter' }),
      }),
    );
  });

  it('ignores an outdated local URL while accepting a subsequent external navigation', () => {
    store.patchFilters({ search: 'mart' });
    const info = router.navigate.calls.mostRecent().args[1]?.info;
    store.patchFilters({ search: 'martinez' });
    router.getCurrentNavigation.and.returnValue({ extras: { info } } as Navigation);
    query.next(convertToParamMap({ q: 'mart' }));
    expect(store.filters().search).toBe('martinez');
    router.getCurrentNavigation.and.returnValue(null);
    query.next(convertToParamMap({ q: 'nicolo' }));
    expect(store.filters().search).toBe('nicolo');
  });

  it('produces no results for inverted ranges and keeps the range removable', () => {
    store.patchFilters({ minFvm: 100, maxFvm: 20 });
    expect(store.resultsCount()).toBe(0);
    store.removeFilter('maxFvm');
    expect(store.resultsCount()).toBe(2);
  });

  it('removes individual chips and resets all filters', () => {
    store.patchFilters({ macroRole: 'A', teams: ['Inter'], minFvm: 20 });
    expect(store.activeFiltersCount()).toBe(3);
    store.removeFilter('team:Inter');
    expect(store.filters().teams).toEqual([]);
    store.resetFilters();
    expect(store.hasActiveFilters()).toBeFalse();
    expect(store.resultsCount()).toBe(4);
  });

  it('cycles numeric sorting from original through descending, ascending and original', () => {
    store.cycleSort('fvm');
    expect(store.filters().sort).toBe('fvm-desc');
    store.cycleSort('fvm');
    expect(store.filters().sort).toBe('fvm-asc');
    store.cycleSort('fvm');
    expect(store.filters().sort).toBe('original');
  });
});
