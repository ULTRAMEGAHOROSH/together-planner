import { Component, computed, input, output } from '@angular/core';
import type { IsoDate } from '@core/api/models/common.models';
import { addDays, WEEKDAYS_SHORT } from '@shared/time';

/**
 * The seven days of the week as chips (prototype, «День»): «Пн 9», the chosen one filled,
 * today marked with a dot while it is not the chosen one. Scrolls sideways on a narrow
 * screen. Presentational: it only says which day was chosen.
 */
@Component({
  selector: 'tp-day-chips',
  template: `
    @for (chip of chips(); track chip.date) {
      <button
        type="button"
        class="chip"
        [attr.aria-pressed]="chip.selected"
        [attr.aria-current]="chip.today ? 'date' : null"
        (click)="dayChange.emit(chip.date)"
      >
        {{ chip.label }}
        @if (chip.today && !chip.selected) {
          <span class="dot" aria-hidden="true"></span>
        }
      </button>
    }
  `,
  styleUrl: './day-chips.scss',
  host: { role: 'group', 'aria-label': 'Дни недели' },
})
export class DayChips {
  /** Monday of the week. */
  readonly weekStart = input.required<IsoDate>();
  readonly selectedDay = input.required<IsoDate>();
  readonly today = input.required<IsoDate>();
  readonly dayChange = output<IsoDate>();

  protected readonly chips = computed(() =>
    WEEKDAYS_SHORT.map((weekday, index) => {
      const date = addDays(this.weekStart(), index);
      return {
        date,
        label: `${weekday} ${Number(date.slice(8, 10))}`,
        selected: date === this.selectedDay(),
        today: date === this.today(),
      };
    }),
  );
}
