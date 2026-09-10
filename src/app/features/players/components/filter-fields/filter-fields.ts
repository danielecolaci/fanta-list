import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { PlayerFilters } from '../../models/player-filters.model';
import { normalizeSearch } from '../../models/player.model';

type NumericFilter = 'minFvm' | 'maxFvm' | 'minQuotation' | 'maxQuotation';

@Component({
  selector: 'app-filter-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filter-fields.html',
  host: { class: 'block' },
})
export class FilterFields {
  readonly filters = input.required<PlayerFilters>();
  readonly teams = input.required<string[]>();
  readonly roles = input.required<string[]>();
  readonly idPrefix = input.required<string>();
  readonly filtersChange = output<Partial<PlayerFilters>>();

  protected readonly teamSearch = signal('');
  private readonly indexedTeams = computed(() =>
    this.teams().map((team) => ({ team, normalized: normalizeSearch(team) })),
  );
  protected readonly visibleTeams = computed(() => {
    const query = normalizeSearch(this.teamSearch());
    return this.indexedTeams().filter((entry) => entry.normalized.includes(query));
  });
  protected readonly invalidFvmRange = computed(() => {
    const { minFvm, maxFvm } = this.filters();
    return minFvm !== null && maxFvm !== null && minFvm > maxFvm;
  });
  protected readonly invalidQuotationRange = computed(() => {
    const { minQuotation, maxQuotation } = this.filters();
    return minQuotation !== null && maxQuotation !== null && minQuotation > maxQuotation;
  });

  protected toggleSelection(field: 'roles' | 'teams', value: string): void {
    const current = this.filters()[field];
    this.filtersChange.emit({
      [field]: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  }

  protected setNumber(field: NumericFilter, input: HTMLInputElement): void {
    const parsed = input.valueAsNumber;
    const value = input.value === '' || !Number.isFinite(parsed) ? null : Math.max(0, parsed);
    if (parsed < 0) {
      input.value = '0';
    }
    this.filtersChange.emit({ [field]: value });
  }
}
