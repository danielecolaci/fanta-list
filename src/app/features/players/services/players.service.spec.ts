import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Player } from '../models/player.model';
import { PlayersService } from './players.service';

const player: Player = {
  id: 'D-test-roma',
  originalIndex: 1,
  name: 'Test',
  team: 'Roma',
  macroRole: 'D',
  roles: ['Dc', 'Do'],
  fvm: { value: 52, secondaryValue: 60 },
  quotation: { value: 8, secondaryValue: 7 },
};

describe('PlayersService', () => {
  let service: PlayersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PlayersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the static dataset and preserves secondary values and all roles', () => {
    expect(service.loading()).toBeTrue();
    http.expectOne('/data/players.json').flush([player]);
    expect(service.players()).toEqual([player]);
    expect(service.loading()).toBeFalse();
    expect(service.error()).toBeNull();
  });

  it('rejects duplicate IDs instead of showing a partial dataset', () => {
    http.expectOne('/data/players.json').flush([player, player]);
    expect(service.players()).toEqual([]);
    expect(service.error()).toContain('duplicato');
    expect(service.loading()).toBeFalse();
  });

  it('rejects malformed numeric values', () => {
    http
      .expectOne('/data/players.json')
      .flush([{ ...player, fvm: { value: '52', secondaryValue: 60 } }]);
    expect(service.error()).toContain('riga 1');
    expect(service.players()).toEqual([]);
  });

  it('supports retry after a network error', () => {
    http
      .expectOne('/data/players.json')
      .flush('Unavailable', { status: 503, statusText: 'Unavailable' });
    expect(service.error()).toBeTruthy();
    service.load();
    expect(service.error()).toBeNull();
    expect(service.loading()).toBeTrue();
    http.expectOne('/data/players.json').flush([player]);
    expect(service.players().length).toBe(1);
  });

  it('rejects an empty dataset', () => {
    http.expectOne('/data/players.json').flush([]);
    expect(service.error()).toContain('almeno un calciatore');
  });
});
