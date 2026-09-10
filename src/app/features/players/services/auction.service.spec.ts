import { TestBed } from '@angular/core/testing';
import { AUCTION_STORAGE_KEY, AuctionService, parseAuctionStorage } from './auction.service';

describe('AuctionService', () => {
  beforeEach(() => localStorage.removeItem(AUCTION_STORAGE_KEY));
  afterEach(() => localStorage.removeItem(AUCTION_STORAGE_KEY));

  it('validates persisted state and rejects corrupt or incompatible data', () => {
    expect(parseAuctionStorage(null)).toEqual({});
    expect(parseAuctionStorage('{"version":1,"statuses":{"A-test-inter":"purchased"}}')).toEqual({
      'A-test-inter': 'purchased',
    });
    for (const raw of [
      'broken',
      'null',
      '{"version":2,"statuses":{}}',
      '{"version":1,"statuses":[]}',
      '{"version":1,"statuses":{"id":"invalid"}}',
    ]) {
      expect(() => parseAuctionStorage(raw)).toThrow();
    }
  });

  it('persists reversible player transitions without clearing other players', () => {
    const service = TestBed.inject(AuctionService);
    service.setStatus('P-first-team', 'called');
    service.setStatus('A-other-team', 'purchased');
    service.setStatus('P-first-team', 'purchased');
    expect(parseAuctionStorage(localStorage.getItem(AUCTION_STORAGE_KEY))).toEqual({
      'P-first-team': 'purchased',
      'A-other-team': 'purchased',
    });
    service.setStatus('P-first-team', 'available');
    expect(service.statuses()).toEqual({ 'A-other-team': 'purchased' });
    expect(parseAuctionStorage(localStorage.getItem(AUCTION_STORAGE_KEY))).toEqual(
      service.statuses(),
    );
  });

  it('ignores unknown status values and empty identifiers', () => {
    const service = TestBed.inject(AuctionService);
    service.setStatus('test', 'invalid');
    service.setStatus('', 'called');
    expect(service.statuses()).toEqual({});
    expect(localStorage.getItem(AUCTION_STORAGE_KEY)).toBeNull();
  });

  it('keeps usable in-memory state and explains persistence failure', () => {
    const service = TestBed.inject(AuctionService);
    spyOn(Storage.prototype, 'setItem').and.throwError('QuotaExceededError');
    service.setStatus('test', 'called');
    expect(service.statuses()['test']).toBe('called');
    expect(service.persistenceError()).toContain('non consente il salvataggio');
  });
});
