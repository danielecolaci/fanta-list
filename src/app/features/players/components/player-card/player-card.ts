import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Player } from '../../models/player.model';
import { ROLE_BADGES, ROLE_LABELS } from '../player-presentation';
import { AuctionStatusControl } from '../auction-status/auction-status';

@Component({
  selector: 'app-player-card',
  imports: [AuctionStatusControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './player-card.html',
  host: { class: 'block' },
})
export class PlayerCard {
  readonly player = input.required<Player>();
  protected readonly expanded = signal(false);
  protected readonly roleBadges = ROLE_BADGES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly fullRole = computed(
    () => `${this.player().macroRole}(${this.player().roles.join(',')})`,
  );
  protected readonly accessibleLabel = computed(() => {
    const player = this.player();
    return (
      `${player.name}, ${player.team}, ${ROLE_LABELS[player.macroRole]}, ${player.roles.join(', ')}, ` +
      `FVM ${player.fvm.value}, quotazione ${player.quotation.value}. ${this.expanded() ? 'Chiudi' : 'Mostra'} dettagli.`
    );
  });
}
