import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { Player, parsePlayers } from '../models/player.model';

@Injectable({ providedIn: 'root' })
export class PlayersService {
  private readonly http = inject(HttpClient);
  private readonly playerState = signal<Player[]>([]);
  private readonly loadingState = signal(true);
  private readonly errorState = signal<string | null>(null);
  private request?: Subscription;

  readonly players = this.playerState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
    this.load();
  }

  load(): void {
    this.request?.unsubscribe();
    this.loadingState.set(true);
    this.errorState.set(null);
    this.request = this.http.get<unknown>('/data/players.json').subscribe({
      next: (data) => {
        try {
          this.playerState.set(parsePlayers(data));
        } catch (error: unknown) {
          this.playerState.set([]);
          this.errorState.set(error instanceof Error ? error.message : 'Dataset non valido.');
        }
        this.loadingState.set(false);
      },
      error: () => {
        this.playerState.set([]);
        this.errorState.set('Impossibile caricare /data/players.json.');
        this.loadingState.set(false);
      },
    });
  }
}
