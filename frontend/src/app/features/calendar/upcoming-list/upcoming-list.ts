import { Component, computed, input, output } from '@angular/core';
import type { IsoDate } from '@core/api/models/common.models';
import type { EventResponse } from '@core/api/models/event.models';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { styleOf } from '@shared/domain';
import { daysBetween, rangeText, relDays, weekShort, weekStartOf } from '@shared/time';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { ErrorState } from '@shared/ui/error-state/error-state';

interface Row {
  readonly id: string;
  readonly title: string;
  readonly dot: string;
  readonly when: string;
  readonly who: string;
  readonly week: string;
  readonly rel: string;
}

/**
 * The block «Запланировано» (prototype, CAL-02): the nearest manual events — the dot of the
 * category, the title, the time, who takes part, the week and «через 3 дня» — and the
 * dashed button for an event in the future. Presentational: it says what was clicked.
 */
@Component({
  selector: 'tp-upcoming-list',
  imports: [EmptyState, ErrorState],
  templateUrl: './upcoming-list.html',
  styleUrl: './upcoming-list.scss',
})
export class UpcomingList {
  readonly events = input.required<readonly EventResponse[]>();
  readonly members = input.required<readonly MemberResponse[]>();
  /** «Today» in the workspace zone: the days to an event are counted from it. */
  readonly today = input.required<IsoDate>();
  readonly loading = input(false);
  /** The text of an error, or `null`. */
  readonly errorText = input<string | null>(null);
  readonly open = output<string>();
  readonly create = output();
  readonly retry = output();

  protected readonly rows = computed<readonly Row[]>(() => {
    const today = this.today();
    const members = this.members();
    return this.events().map((event) => {
      const day = event.start.slice(0, 10);
      return {
        id: event.id,
        title: event.title,
        dot: styleOf(event).dot,
        when: rangeText(event.start, event.end),
        who: this.who(event, members),
        week: `неделя ${weekShort(weekStartOf(day))}`,
        rel: relDays(daysBetween(today, day)),
      };
    });
  });

  /** «Даулет и Айгерим» for a joint event, else the name (prototype). */
  private who(event: EventResponse, members: readonly MemberResponse[]): string {
    const names = members
      .filter((m) => event.participantIds.includes(m.userId))
      .map((m) => m.displayName);
    return names.join(' и ');
  }
}
