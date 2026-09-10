import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  DestroyRef,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';

export type AuctionStatus = 'available' | 'called' | 'purchased';
export const AUCTION_STORAGE_KEY = 'fantalist-auction-2026-27';
export const AUCTION_STATUSES: ReadonlyArray<{ value: AuctionStatus; label: string }> = [
  { value: 'available', label: 'Disponibile' },
  { value: 'called', label: 'Chiamato' },
  { value: 'purchased', label: 'Acquistato' },
];

export function parseAuctionStorage(raw: string | null): Record<string, AuctionStatus> {
  if (raw === null) return {};
  const data: unknown = JSON.parse(raw);
  if (
    typeof data !== 'object' ||
    data === null ||
    !('version' in data) ||
    data.version !== 1 ||
    !('statuses' in data) ||
    typeof data.statuses !== 'object' ||
    data.statuses === null ||
    Array.isArray(data.statuses)
  ) {
    throw new Error('Stato asta salvato non valido.');
  }
  const entries = Object.entries(data.statuses);
  if (
    entries.some(
      ([id, value]) => !id.trim() || !AUCTION_STATUSES.some((status) => status.value === value),
    )
  ) {
    throw new Error('Stato calciatore salvato non valido.');
  }
  return Object.fromEntries(entries);
}

@Injectable({ providedIn: 'root' })
export class AuctionService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly state = signal<Record<string, AuctionStatus>>({});
  readonly statuses = this.state.asReadonly();
  readonly persistenceError = signal<string | null>(null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (!this.browser) return;
      const view = this.document.defaultView;
      if (!view) return;
      try {
        this.state.set(parseAuctionStorage(view.localStorage.getItem(AUCTION_STORAGE_KEY)));
      } catch {
        this.persistenceError.set('Impossibile recuperare lo stato salvato dell’asta.');
      }
      const onStorage = (event: StorageEvent) => {
        if (event.key !== AUCTION_STORAGE_KEY && event.key !== null) return;
        try {
          if (event.storageArea !== view.localStorage) return;
          this.state.set(parseAuctionStorage(event.newValue));
          this.persistenceError.set(null);
        } catch {
          this.persistenceError.set(
            'Impossibile leggere l’aggiornamento dell’asta da un’altra scheda.',
          );
        }
      };
      view.addEventListener('storage', onStorage);
      destroyRef.onDestroy(() => view.removeEventListener('storage', onStorage));
    });
  }

  setStatus(id: string, value: string): void {
    if (!id.trim() || !AUCTION_STATUSES.some((status) => status.value === value)) return;
    const next = { ...this.state() };
    if (value === 'available') delete next[id];
    else next[id] = value as AuctionStatus;
    this.state.set(next);
    if (!this.browser) return;
    try {
      this.document.defaultView?.localStorage.setItem(
        AUCTION_STORAGE_KEY,
        JSON.stringify({ version: 1, statuses: next }),
      );
      this.persistenceError.set(null);
    } catch {
      this.persistenceError.set(
        'Il browser non consente il salvataggio: lo stato d’asta resterà disponibile solo fino alla chiusura della pagina.',
      );
    }
  }
}
