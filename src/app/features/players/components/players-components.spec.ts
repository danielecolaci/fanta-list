import { TestBed } from '@angular/core/testing';
import { emptyFilters, PlayerFilters, PlayerSort } from '../models/player-filters.model';
import { Player } from '../models/player.model';
import { FilterFields } from './filter-fields/filter-fields';
import { PlayerCard } from './player-card/player-card';
import { PlayersTable } from './players-table/players-table';

const player: Player = {
  id: 'D-test-atalanta',
  originalIndex: 1,
  name: 'Nome di prova',
  team: 'Atalanta',
  macroRole: 'D',
  roles: ['Dc', 'Do'],
  fvm: { value: 52, secondaryValue: 48 },
  quotation: { value: 18, secondaryValue: 17 },
};

describe('Players UI components', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerCard, PlayersTable, FilterFields],
    }).compileComponents();
  });

  it('makes auction values accessible and toggles all original values in the card', () => {
    const fixture = TestBed.createComponent(PlayerCard);
    fixture.componentRef.setInput('player', player);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector('button')!;

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toContain('FVM 52, quotazione 18');
    const details = host.querySelector('#player-details-D-test-atalanta')!;
    expect(details.getAttribute('aria-hidden')).toBe('true');

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(details.getAttribute('aria-hidden')).toBe('false');
    expect(details.textContent).toContain('D(Dc,Do)');
    expect(details.textContent).toContain('48');
    expect(details.textContent).toContain('17');
  });

  it('cycles numeric table sorting and exposes its direction semantically', () => {
    const fixture = TestBed.createComponent(PlayersTable);
    fixture.componentRef.setInput('players', [player]);
    fixture.componentRef.setInput('sort', 'original');
    const emitted: PlayerSort[] = [];
    fixture.componentInstance.sortChange.subscribe((sort) => {
      emitted.push(sort);
      fixture.componentRef.setInput('sort', sort);
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const fvmHeader = host.querySelectorAll('thead th')[4];
    const button = fvmHeader.querySelector('button')!;

    button.click();
    fixture.detectChanges();
    expect(fvmHeader.getAttribute('aria-sort')).toBe('descending');
    button.click();
    fixture.detectChanges();
    expect(fvmHeader.getAttribute('aria-sort')).toBe('ascending');
    button.click();
    fixture.detectChanges();
    expect(fvmHeader.getAttribute('aria-sort')).toBe('none');
    expect(emitted).toEqual(['fvm-desc', 'fvm-asc', 'original']);
  });

  it('searches teams without accents and emits independent multi-select changes', () => {
    const fixture = TestBed.createComponent(FilterFields);
    fixture.componentRef.setInput('filters', emptyFilters());
    fixture.componentRef.setInput('teams', [
      'Atalànta',
      'Bologna',
      'Como',
      'Fiorentina',
      'Inter',
      'Juventus',
      'Lazio',
      'Milan',
      'Napoli',
    ]);
    fixture.componentRef.setInput('roles', ['Dc', 'Do']);
    fixture.componentRef.setInput('idPrefix', 'test');
    const patches: Partial<PlayerFilters>[] = [];
    fixture.componentInstance.filtersChange.subscribe((patch) => patches.push(patch));
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const search = host.querySelector<HTMLInputElement>('#test-team-search')!;
    search.value = '  ATALANTA ';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const checkboxes = host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes.length).toBe(1);
    checkboxes[0].click();
    expect(patches).toEqual([{ teams: ['Atalànta'] }]);
  });

  it('explains reversed ranges and prevents a negative bound entering application state', () => {
    const fixture = TestBed.createComponent(FilterFields);
    fixture.componentRef.setInput('filters', { ...emptyFilters(), minFvm: 50, maxFvm: 10 });
    fixture.componentRef.setInput('teams', []);
    fixture.componentRef.setInput('roles', []);
    fixture.componentRef.setInput('idPrefix', 'test');
    const patches: Partial<PlayerFilters>[] = [];
    fixture.componentInstance.filtersChange.subscribe((patch) => patches.push(patch));
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const minimum = host.querySelector<HTMLInputElement>('#test-min-fvm')!;

    expect(minimum.getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector('#test-fvm-error')?.textContent).toContain('minore o uguale');
    minimum.value = '-12';
    minimum.dispatchEvent(new Event('input'));
    expect(patches).toEqual([{ minFvm: 0 }]);
    expect(minimum.value).toBe('0');
  });
});
