import { Component, computed, ElementRef, input, model, viewChildren } from '@angular/core';

export interface SegmentOption<T> {
  value: T;
  label: string;
}

const STEP: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * One choice out of a few (Вход / Регистрация, Неделя / День). A radio group: Tab enters
 * on the chosen option, arrows move and choose (wrapping around), Home / End jump to the
 * first / last option.
 *
 * ```html
 * <tp-segmented-control label="Режим просмотра" [options]="views" [(value)]="view" />
 * ```
 */
@Component({
  selector: 'tp-segmented-control',
  templateUrl: './segmented-control.html',
  styleUrl: './segmented-control.scss',
  host: {
    role: 'radiogroup',
    '[attr.aria-label]': 'label()',
    '[class.sm]': "size() === 'sm'",
    '(keydown)': 'onKeydown($event)',
  },
})
export class SegmentedControl<T> {
  readonly options = input.required<readonly SegmentOption<T>[]>();
  readonly value = model.required<T>();
  /** Accessible name of the group. */
  readonly label = input.required<string>();
  /** `md` 38 px (auth card), `sm` 34 px (toolbar). */
  readonly size = input<'sm' | 'md'>('md');

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('option');

  /** The chosen option; the first one takes Tab if the value matches none. */
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
