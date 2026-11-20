import { Component, computed, inject, input } from '@angular/core';
import type { TemplateEventResponse } from '@core/api/models/template.models';
import { SessionStore } from '@core/auth/session-store';
import { DAY_HEIGHT } from '@shared/timeline/engine/constants';
import { buildPanelLayout } from '@shared/timeline/engine/panel-layout';
import {
  TEMPLATE_WEEK_START,
  templateToTimelineEvents,
} from '@shared/timeline/engine/template-to-timeline';

/** The height of a day in the miniature (prototype: 96 px). */
export const MINI_DAY_HEIGHT = 96;
const SCALE = MINI_DAY_HEIGHT / DAY_HEIGHT;

interface MiniBar {
  readonly key: string;
  readonly top: number;
  readonly height: number;
  readonly color: string;
}
interface MiniDay {
  readonly label: string;
  /** One column per member: seat 1 on the left, seat 2 on the right. */
  readonly columns: readonly (readonly MiniBar[])[];
}

/**
 * The week of a template in miniature (TPL-11, prototype): seven small days, in each the
 * first member's column on the left and the second one's on the right, 96 px for 24 hours.
 * Decoration (`aria-hidden`): the chips of the card say the same in words. The bars are
 * the cards of the board, so an event past Sunday midnight continues on Monday.
 */
@Component({
  selector: 'tp-template-mini-grid',
  host: { 'aria-hidden': 'true' },
  template: `
    @for (day of days(); track $index) {
      <div class="day">
        <div class="columns">
          @for (column of day.columns; track $index) {
            <div class="column">
              @for (bar of column; track bar.key) {
                <span
                  class="bar"
                  [style.top.px]="bar.top"
                  [style.height.px]="bar.height"
                  [style.background]="bar.color"
                ></span>
              }
            </div>
          }
        </div>
        <span class="label">{{ day.label }}</span>
      </div>
    }
  `,
  styleUrl: './template-mini-grid.scss',
})
export class TemplateMiniGrid {
  readonly events = input.required<readonly TemplateEventResponse[]>();

  private readonly session = inject(SessionStore);

  protected readonly days = computed<readonly MiniDay[]>(() => {
    const events = templateToTimelineEvents(this.events());
    const layouts = this.session.members().map((member) =>
      buildPanelLayout(events, { firstDay: TEMPLATE_WEEK_START, dayCount: 7 }, member.userId, {
        today: null,
        withDates: false,
      }),
    );
    return Array.from({ length: 7 }, (_, index): MiniDay => {
      const days = layouts.map((layout) => layout.days[index]);
      return {
        label: days[0]?.weekdayShort ?? '',
        columns: days.map((day) =>
          day.boxes.map((box) => ({
            key: box.key,
            top: box.top * SCALE,
            height: Math.max(box.height * SCALE - 0.6, 1.4),
            color: box.colors.dot,
          })),
        ),
      };
    });
  });
}
