import { Component, input, output } from '@angular/core';
import type { IsoDate, Uuid } from '@core/api/models/common.models';
import { Avatar } from '@shared/ui/avatar/avatar';
import type { NowMark } from '../../engine/model';
import type { BoardPanel, SlotClick } from '../board.models';
import { DayColumn } from '../day-column/day-column';
import { DayHeader } from '../day-header/day-header';

/**
 * One member's half of the board (prototype): a sticky header (seat stripe, avatar, name,
 * day headers) and the day columns under it. Two rows of the board grid (subgrid).
 */
@Component({
  selector: 'tp-person-panel',
  imports: [Avatar, DayColumn, DayHeader],
  templateUrl: './person-panel.html',
  styleUrl: './person-panel.scss',
  host: {
    role: 'group',
    '[attr.aria-label]': 'panel().name',
    '[style.--days]': 'panel().layout.days.length',
  },
})
export class PersonPanel {
  readonly panel = input.required<BoardPanel>();
  readonly now = input<NowMark | null>(null);
  /** The day headers are buttons: open the day / back to the week. */
  readonly dayNavigation = input(false);
  readonly slotClick = output<SlotClick>();
  readonly eventClick = output<Uuid>();
  readonly dayClick = output<IsoDate>();
}
