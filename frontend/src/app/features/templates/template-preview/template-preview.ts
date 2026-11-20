import { Component, computed, input, output } from '@angular/core';
import type { Uuid } from '@core/api/models/common.models';
import type { MemberResponse, Seat } from '@core/api/models/workspace.models';
import type { BoardPanel } from '@shared/timeline/board/board.models';
import { ScheduleBoard } from '@shared/timeline/board/schedule-board/schedule-board';
import { buildPanelLayout } from '@shared/timeline/engine/panel-layout';
import {
  TEMPLATE_WEEK_START,
  type TemplatePreviewEvent,
  templateToTimelineEvents,
} from '@shared/timeline/engine/template-to-timeline';
import { durationOf, type TemplateForm } from '../template-form';

const ROW_PREFIX = 'row-';

/** The id of a form row in the preview: its position among the rows of the form. */
export const previewIdOfRow = (index: number): Uuid => `${ROW_PREFIX}${index}`;

/** Back from a card to the position of its row; `null` for an id that is not a row's. */
export function rowOfPreviewId(id: Uuid): number | null {
  if (!id.startsWith(ROW_PREFIX)) return null;
  const index = Number(id.slice(ROW_PREFIX.length));
  return Number.isInteger(index) ? index : null;
}

/**
 * What the form shows right now, as the grid reads it: only rows that already make an event
 * (a start, an end, a positive duration, somebody taking part). The rest stay in the list
 * until they are filled in. Display only — nothing here is sent anywhere.
 */
export function previewEventsOfForm(
  form: TemplateForm,
  members: readonly MemberResponse[],
): TemplatePreviewEvent[] {
  const idOfSeat = (seat: Seat) => members.find((m) => m.seat === seat)?.userId;
  return form.controls.events.controls.flatMap((row, index) => {
    const value = row.getRawValue();
    const duration = durationOf(value);
    const participantIds = [
      value.participants.seat1 ? idOfSeat(1) : undefined,
      value.participants.seat2 ? idOfSeat(2) : undefined,
    ].filter((id): id is Uuid => id !== undefined);
    if (duration === null || duration <= 0 || participantIds.length === 0) return [];
    return [
      {
        id: previewIdOfRow(index),
        title: value.title.trim() || 'Без названия',
        dayOfWeek: value.dayOfWeek,
        startTime: value.startTime,
        durationMinutes: duration,
        participantIds,
        category: value.category,
        color: value.color,
      },
    ];
  });
}

/**
 * The template as a week (TPL-09, prototype): the board of both members, read only, over a
 * conditional week — the headers are weekdays without dates. A card goes to its row.
 */
@Component({
  selector: 'tp-template-preview',
  imports: [ScheduleBoard],
  template: `
    <tp-schedule-board
      class="board"
      [panels]="panels()"
      [readOnly]="true"
      (eventClick)="rowClick.emit($event)"
    />
    @if (events().length === 0) {
      <p class="hint">В шаблоне пока нечего показывать: добавьте события во вкладке «Список».</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .board {
      display: block;
      height: min(70vh, 720px);
      overflow: auto;
      border: 1px solid var(--tp-color-border);
      border-radius: var(--tp-radius-lg);
    }
    .hint {
      margin: 0;
      color: var(--tp-color-text-subtle);
      font-size: 14px;
    }
  `,
})
export class TemplatePreview {
  readonly events = input.required<readonly TemplatePreviewEvent[]>();
  readonly members = input.required<readonly MemberResponse[]>();
  /** A card was chosen: the id of its event (`previewIdOfRow` for the rows of a form). */
  readonly rowClick = output<Uuid>();

  protected readonly panels = computed<readonly BoardPanel[]>(() => {
    const events = templateToTimelineEvents(this.events());
    return [...this.members()]
      .sort((a, b) => a.seat - b.seat)
      .map((member) => ({
        name: member.displayName,
        seat: member.seat,
        layout: buildPanelLayout(
          events,
          { firstDay: TEMPLATE_WEEK_START, dayCount: 7 },
          member.userId,
          { today: null, withDates: false },
        ),
      }));
  });
}
