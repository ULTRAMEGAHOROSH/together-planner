import { Component, computed, input } from '@angular/core';

/** Line icons drawn in the prototype (design/Main.dc.html), 24×24, stroke = currentColor. */
export const ICON_NAMES = [
  'plus',
  'chevron-left',
  'chevron-right',
  'arrow-left',
  'close',
  'check',
  'alert',
  'layers',
  'trash',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

// Stroke widths as in the prototype; the rest use 2.
const STROKE_WIDTH: Partial<Record<IconName, number>> = { plus: 2.2, check: 2.4 };

/**
 * Inline SVG icon (FD-42). Always decorative (`aria-hidden`): an icon-only button gets
 * its name from `aria-label`.
 */
@Component({
  selector: 'tp-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  host: { 'aria-hidden': 'true' },
})
export class Icon {
  readonly name = input.required<IconName>();
  /** Width and height in px. */
  readonly size = input(18);

  protected readonly strokeWidth = computed(() => STROKE_WIDTH[this.name()] ?? 2);
}
