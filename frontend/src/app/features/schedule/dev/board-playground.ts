import { Component, computed, signal } from '@angular/core';
import { buildPanelLayout } from '@shared/timeline/engine/panel-layout';
import type { DayRange } from '@shared/timeline/engine/model';
import type { BoardPanel, SlotClick } from '@shared/timeline/board/board.models';
import { ScheduleBoard } from '@shared/timeline/board/schedule-board/schedule-board';
import {
  BOARD_SCENARIOS,
  FIXTURE_MEMBERS,
  FIXTURE_TODAY,
  FIXTURE_WEEK,
} from '@shared/timeline/testing/fixtures';
import { WEEKDAYS_SHORT } from '@shared/time/format-ru';
import { weekDays } from '@shared/time/week';
import {
  SegmentedControl,
  type SegmentOption,
} from '@shared/ui/segmented-control/segmented-control';

type Mode = 'week' | 'day';

/**
 * /_dev/board (dev builds only, FD §6): the board on fixtures, without backend or sign-in —
 * to check the layout and the cards against the prototype (WEEK-05, WEEK-06) and the scroll
 * (WEEK-08).
 */
@Component({
  selector: 'tp-board-playground',
  imports: [ScheduleBoard, SegmentedControl],
  template: `
    <div class="toolbar">
      <h1>Площадка доски</h1>
      <tp-segmented-control
        label="Сценарий"
        size="sm"
        [options]="scenarios"
        [value]="scenario()"
        (valueChange)="scenario.set($event)"
      />
      <tp-segmented-control
        label="Режим"
        size="sm"
        [options]="modes"
        [value]="mode()"
        (valueChange)="mode.set($event)"
      />
      @if (mode() === 'day') {
        <tp-segmented-control
          label="День"
          size="sm"
          [options]="days"
          [value]="day()"
          (valueChange)="day.set($event)"
        />
      }
      <output class="last-event">
        @if (lastEvent(); as id) {
          Карточка: {{ id }}
        }
      </output>
      <output class="last-slot">
        @if (lastSlot(); as slot) {
          Клик: {{ slot.personId === members[0].id ? members[0].name : members[1].name }},
          {{ slot.date }}, {{ slot.minute }} мин
        }
      </output>
    </div>
    <tp-schedule-board
      class="board"
      [panels]="panels()"
      (slotClick)="lastSlot.set($event)"
      (eventClick)="lastEvent.set($event)"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      background: var(--tp-color-bg);
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px 16px;
      padding: 14px 20px 10px;
    }
    h1 {
      margin: 0;
      font-size: 18px;
    }
    .last-event,
    .last-slot {
      color: var(--tp-color-text-subtle);
      font-size: 12.5px;
    }
    .board {
      flex: 1 1 0;
      margin: 0 12px 12px;
    }
  `,
})
export class BoardPlayground {
  protected readonly members = FIXTURE_MEMBERS;
  protected readonly scenarios: SegmentOption<string>[] = BOARD_SCENARIOS.map((s) => ({
    value: s.id,
    label: s.label,
  }));
  protected readonly modes: SegmentOption<Mode>[] = [
    { value: 'week', label: 'Неделя' },
    { value: 'day', label: 'День' },
  ];
  protected readonly days: SegmentOption<string>[] = weekDays(FIXTURE_WEEK).map((date, i) => ({
    value: date,
    label: WEEKDAYS_SHORT[i],
  }));

  protected readonly scenario = signal(BOARD_SCENARIOS[0].id);
  protected readonly mode = signal<Mode>('week');
  protected readonly day = signal(FIXTURE_TODAY);
  protected readonly lastSlot = signal<SlotClick | null>(null);
  protected readonly lastEvent = signal<string | null>(null);

  protected readonly panels = computed((): BoardPanel[] => {
    const events = BOARD_SCENARIOS.find((s) => s.id === this.scenario())!.events;
    const range: DayRange =
      this.mode() === 'week'
        ? { firstDay: FIXTURE_WEEK, dayCount: 7 }
        : { firstDay: this.day(), dayCount: 1 };
    return FIXTURE_MEMBERS.map((member) => ({
      name: member.name,
      seat: member.seat,
      layout: buildPanelLayout(events, range, member.id, { today: FIXTURE_TODAY }),
    }));
  });
}
