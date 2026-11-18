import { Component, input } from '@angular/core';

/**
 * «Nothing here yet»: a dashed card with a text and optional actions (projected buttons).
 *
 * ```html
 * <tp-empty-state text="На эту неделю пока ничего нет.">
 *   <button tpButton size="sm" type="button" (click)="apply()">Применить шаблон</button>
 * </tp-empty-state>
 * ```
 */
@Component({
  selector: 'tp-empty-state',
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
})
export class EmptyState {
  readonly text = input.required<string>();
}
