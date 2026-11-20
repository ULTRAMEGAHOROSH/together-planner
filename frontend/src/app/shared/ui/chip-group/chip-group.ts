import { Component, computed, ElementRef, input, model, viewChildren } from '@angular/core';

export interface ChipOption<T> {
  value: T;
  label: string;
  /** Marker dot color (CSS value). Without it the chip has no dot. */
  dot?: string;
  /** Chip background and text, CSS values; the default look is a white chip. */
  bg?: string;
  fg?: string;
}

const STEP: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * One choice out of several pill chips that wrap onto lines (event category). A radio
 * group like `tp-segmented-control`: Tab enters on the chosen chip, arrows move and choose
 * (wrapping around), Home / End jump to the first / last chip.
 *
 * ```html
 * <tp-chip-group label="Категория" [options]="categories" [(value)]="category" />
 * ```
 */
@Component({
  selector: 'tp-chip-group',
  templateUrl: './chip-group.html',
  styleUrl: './chip-group.scss',
  host: {
    role: 'radiogroup',
    '[attr.aria-label]': 'label()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class ChipGroup<T> {
  readonly options = input.required<readonly ChipOption<T>[]>();
  readonly value = model.required<T>();
  /** Accessible name of the group. */
  readonly label = input.required<string>();

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('chip');

  /** The chosen chip; the first one takes Tab if the value matches none. */
  protected readonly selected = computed(() =>
    this.options().findIndex((o) => Object.is(o.value, this.value())),
  );
  protected readonly focusable = computed(() => Math.max(this.selected(), 0));

  protected choose(index: number): void {
    this.value.set(this.options()[index].value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.options().length;
    let index: number;
    if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = count - 1;
    else if (event.key in STEP) index = (this.focusable() + STEP[event.key] + count) % count;
    else return;
    event.preventDefault();
    this.choose(index);
    this.buttons()[index].nativeElement.focus();
  }
}
