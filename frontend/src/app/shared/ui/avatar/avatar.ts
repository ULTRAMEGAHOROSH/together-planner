import { Component, computed, input } from '@angular/core';
import type { Seat } from '@core/api/models/workspace.models';
import { initialOf } from '@shared/domain/participants';

/**
 * Round avatar of a workspace member: first letter of the name on the seat color.
 * Decorative: the name is always shown or read next to it (button label, column title).
 * The caller may add a ring or overlap through its own class on the element.
 */
@Component({
  selector: 'tp-avatar',
  // The letter is drawn by CSS (`::before`), not text: it is not part of the visible text of a
  // button that holds the avatar, so the button's name can match what is read (WCAG 2.5.3).
  template: '',
  styleUrl: './avatar.scss',
  host: {
    'aria-hidden': 'true',
    '[attr.data-initial]': 'initial()',
    '[class.seat-1]': 'seat() === 1',
    '[class.seat-2]': 'seat() === 2',
    '[class.sm]': "size() === 'sm'",
  },
})
export class Avatar {
  readonly name = input.required<string>();
  readonly seat = input.required<Seat>();
  /** `md` 34 px (header), `sm` 28 px (column titles, participant picker). */
  readonly size = input<'sm' | 'md'>('md');

  protected readonly initial = computed(() => initialOf(this.name()));
}
