import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { ThemeService } from '../../../../core/theme.service';
import { FilterFields } from '../../components/filter-fields/filter-fields';
import { PlayerCard } from '../../components/player-card/player-card';
import { PlayersTable } from '../../components/players-table/players-table';
import {
  DEFAULT_FILTERS,
  PlayerFilters,
  PlayerSort,
  SORT_OPTIONS,
} from '../../models/player-filters.model';
import { MACRO_ROLES } from '../../models/player.model';
import { PlayersService } from '../../services/players.service';
import { PlayersStore } from '../../services/players.store';
import { AuctionService } from '../../services/auction.service';

@Component({
  selector: 'app-players-page',
  imports: [FilterFields, PlayerCard, PlayersTable],
  providers: [PlayersStore],
  templateUrl: './players-page.html',
  styleUrl: './players-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayersPage {
  readonly store = inject(PlayersStore);
  readonly data = inject(PlayersService);
  readonly theme = inject(ThemeService);
  readonly auction = inject(AuctionService);
  readonly macroRoles = MACRO_ROLES;
  readonly sortOptions = SORT_OPTIONS;
  readonly skeletonRows = Array.from({ length: 9 }, (_, index) => index);
  readonly draft = signal<PlayerFilters>({ ...DEFAULT_FILTERS, roles: [], teams: [] });
  readonly drawerOpen = signal(false);
  readonly isDesktop = signal(false);
  readonly filterDialog = viewChild<ElementRef<HTMLDialogElement>>('filterDialog');
  readonly resultsLabel = computed(() => {
    const role = this.macroRoles.find((item) => item.value === this.store.filters().macroRole);
    return this.store.resultsCount() === 1
      ? (role?.singular.toLowerCase() ?? 'calciatore')
      : (role?.label.toLowerCase() ?? 'calciatori');
  });
  readonly invalidDraft = computed(() => this.invalidRanges(this.draft()));
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private unlockScroll: (() => void) | undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.unlockScroll?.());
    afterNextRender(() => {
      if (!this.browser) return;
      const media = this.document.defaultView?.matchMedia('(min-width: 64rem)');
      if (!media) return;
      const update = () => {
        this.isDesktop.set(media.matches);
        if (media.matches && this.drawerOpen()) this.closeFilters();
      };
      update();
      media.addEventListener('change', update);
      destroyRef.onDestroy(() => media.removeEventListener('change', update));
    });
  }

  changeSort(value: string): void {
    if (this.sortOptions.some((option) => option.value === value))
      this.store.patchFilters({ sort: value as PlayerSort });
  }

  patchDraft(patch: Partial<PlayerFilters>): void {
    this.draft.update((filters) => ({ ...filters, ...patch }));
  }

  resetDraft(): void {
    this.draft.update((filters) => ({
      ...filters,
      roles: [],
      teams: [],
      minFvm: null,
      maxFvm: null,
      minQuotation: null,
      maxQuotation: null,
    }));
  }

  openFilters(): void {
    if (!this.browser) return;
    const dialog = this.filterDialog()?.nativeElement;
    const view = this.document.defaultView;
    if (!dialog || !view || dialog.open) return;
    this.draft.set({
      ...this.store.filters(),
      roles: [...this.store.filters().roles],
      teams: [...this.store.filters().teams],
    });
    const body = this.document.body;
    const scrollY = view.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    dialog.showModal();
    this.drawerOpen.set(true);
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    this.unlockScroll = () => {
      Object.assign(body.style, previous);
      view.scrollTo({ top: scrollY, behavior: 'instant' });
      this.unlockScroll = undefined;
    };
  }

  closeFilters(): void {
    this.filterDialog()?.nativeElement.close();
    this.drawerOpen.set(false);
    this.unlockScroll?.();
  }

  cancelFilters(event: Event): void {
    event.preventDefault();
    this.closeFilters();
  }

  trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.browser) return;
    const dialog = this.filterDialog()?.nativeElement;
    if (!dialog) return;
    const targets = [
      ...dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      ),
    ];
    const first = targets[0];
    const last = targets[targets.length - 1];
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  closeFromBackdrop(event: MouseEvent): void {
    const dialog = this.filterDialog()?.nativeElement;
    if (event.target !== dialog || !dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      this.closeFilters();
    }
  }

  applyFilters(): void {
    if (this.invalidDraft()) return;
    const { roles, teams, minFvm, maxFvm, minQuotation, maxQuotation } = this.draft();
    this.store.patchFilters({ roles, teams, minFvm, maxFvm, minQuotation, maxQuotation });
    this.closeFilters();
  }

  private invalidRanges(filters: PlayerFilters): boolean {
    return (
      (filters.minFvm !== null && filters.maxFvm !== null && filters.minFvm > filters.maxFvm) ||
      (filters.minQuotation !== null &&
        filters.maxQuotation !== null &&
        filters.minQuotation > filters.maxQuotation)
    );
  }
}
