import { Component, computed, input } from '@angular/core';
import type { EventResponse } from '@core/api/models/event.models';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { rangeText } from '@shared/time';

/**
 * The card that follows a hovered event (WEEK-14, FD-55): title, time, who takes part, the
 * description, «из шаблона «…»» and the hint. Presentational; shown in an overlay that does
 * not take the pointer, so it neither covers the cursor nor makes the card under it flicker.
 */
@Component({
  selector: 'tp-event-hovercard',
  templateUrl: './event-hovercard.html',
  styleUrl: './event-hovercard.scss',
  host: { role: 'tooltip' },
})
export class EventHovercard {
  readonly event = input.required<EventResponse>();
  readonly members = input.required<readonly MemberResponse[]>();

  protected readonly when = computed(() => rangeText(this.event().start, this.event().end));
  protected readonly who = computed(() =>
    this.members()
      .filter((m) => this.event().participantIds.includes(m.userId))
      .map((m) => m.displayName)
      .join(' и '),
  );
  protected readonly template = computed(() => this.event().source?.templateName ?? null);
}
