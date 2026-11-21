import { Component, computed, input } from '@angular/core';
import type { EventResponse } from '@core/api/models/event.models';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { CATEGORY_PALETTE, styleOf } from '@shared/domain';
import { durText, rangeText } from '@shared/time';
import { parseLocalDateTime } from '@shared/time/local-date-time';

/**
 * The inspector of a hovered event (prototype «инспектор», WEEK-14, FD-55): the dot and name of
 * the category, the title, the time, the length and who takes part, a note for an event over
 * midnight, the description, the note about the template and the hint. Presentational; it is
 * shown in a fixed corner by an overlay that does not take the pointer.
 */
@Component({
  selector: 'tp-event-hovercard',
  templateUrl: './event-hovercard.html',
  styleUrl: './event-hovercard.scss',
  host: { role: 'tooltip' },
})
export class EventHovercard {
  /** The note about midnight wears the colors of sleep, as in the prototype. */
  protected readonly sleep = CATEGORY_PALETTE.SLEEP;
  readonly event = input.required<EventResponse>();
  readonly members = input.required<readonly MemberResponse[]>();

  protected readonly categoryLabel = computed(() => CATEGORY_PALETTE[this.event().category].label);
  protected readonly dot = computed(() => styleOf(this.event()).dot);
  protected readonly when = computed(() => rangeText(this.event().start, this.event().end));
  protected readonly duration = computed(() =>
    durText(parseLocalDateTime(this.event().end) - parseLocalDateTime(this.event().start)),
  );
  protected readonly who = computed(() => {
    const names = this.members()
      .filter((m) => this.event().participantIds.includes(m.userId))
      .map((m) => m.displayName);
    return names.length > 1 ? `вместе: ${names.join(' и ')}` : names.join('');
  });
  /** Starts and ends on different days: the board shows it on both. */
  protected readonly crossesMidnight = computed(
    () => this.event().start.slice(0, 10) !== this.event().end.slice(0, 10),
  );
  protected readonly template = computed(() => this.event().source?.templateName ?? null);
}
