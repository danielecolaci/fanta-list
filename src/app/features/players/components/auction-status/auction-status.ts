import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AUCTION_STATUSES, AuctionService } from '../../services/auction.service';

@Component({
  selector: 'app-auction-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <select
      #statusSelect
      [attr.aria-label]="'Stato asta di ' + playerName()"
      [value]="status()"
      (click)="$event.stopPropagation()"
      (change)="auction.setStatus(playerId(), statusSelect.value)"
      class="min-h-11 w-full min-w-0 rounded-lg border px-2 text-xs font-semibold"
      [class]="
        status() === 'purchased'
          ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200'
          : status() === 'called'
            ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
            : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
      "
    >
      @for (option of options; track option.value) {
        <option [value]="option.value" [selected]="option.value === status()">
          {{ option.label }}
        </option>
      }
    </select>
  `
})
export class AuctionStatusControl {
  readonly playerId = input.required<string>();
  readonly playerName = input.required<string>();
  readonly auction = inject(AuctionService);
  readonly options = AUCTION_STATUSES;
  readonly status = computed(() => this.auction.statuses()[this.playerId()] ?? 'available');
}
