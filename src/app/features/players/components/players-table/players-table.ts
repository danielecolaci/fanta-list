import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Player } from '../../models/player.model';
import { PlayerSort } from '../../models/player-filters.model';
import { ROLE_BADGES, ROLE_LABELS } from '../player-presentation';
import { AuctionStatusControl } from '../auction-status/auction-status';

type SortColumn = 'name' | 'fvm' | 'quotation';

@Component({
  selector: 'app-players-table',
  imports: [AuctionStatusControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './players-table.html',
  host: { class: 'block' },
})
export class PlayersTable {
  readonly players = input.required<Player[]>();
  readonly sort = input.required<PlayerSort>();
  readonly sortChange = output<PlayerSort>();

  protected readonly expandedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly roleBadges = ROLE_BADGES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly directions = computed(() => {
    const sort = this.sort();
    return {
      name: sort === 'name-asc' ? 'ascending' : sort === 'name-desc' ? 'descending' : 'none',
      fvm: sort === 'fvm-asc' ? 'ascending' : sort === 'fvm-desc' ? 'descending' : 'none',
      quotation:
        sort === 'quotation-asc' ? 'ascending' : sort === 'quotation-desc' ? 'descending' : 'none',
    };
  });

  protected changeSort(column: SortColumn): void {
    const sort = this.sort();
    if (column === 'name') {
      this.sortChange.emit(sort === 'name-asc' ? 'name-desc' : 'name-asc');
      return;
    }

    this.sortChange.emit(
      sort === `${column}-desc`
        ? `${column}-asc`
        : sort === `${column}-asc`
          ? 'original'
          : `${column}-desc`,
    );
  }

  protected toggleDetails(id: string): void {
    this.expandedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
}
