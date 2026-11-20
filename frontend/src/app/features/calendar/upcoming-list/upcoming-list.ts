import { Component, input, output } from '@angular/core';
import type { IsoDate } from '@core/api/models/common.models';
import type { EventResponse } from '@core/api/models/event.models';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { UpcomingRows } from '../upcoming-rows/upcoming-rows';

/**
 * The block «Запланировано» (prototype, CAL-02): the nearest manual events — the dot of the
 * category, the title, the time, who takes part, the week and «через 3 дня» — and the
 * dashed button for an event in the future. Presentational: it says what was clicked.
 */
@Component({
  selector: 'tp-upcoming-list',
  imports: [EmptyState, ErrorState, UpcomingRows],
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
  /** «Показать все» (CAL-03): the full list with pages. */
  readonly showAll = output();
  readonly retry = output();
}
