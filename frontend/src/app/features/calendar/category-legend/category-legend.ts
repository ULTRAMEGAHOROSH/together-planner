import { Component } from '@angular/core';
import { EVENT_CATEGORIES } from '@core/api/models/enums';
import { CATEGORY_PALETTE } from '@shared/domain';

/**
 * The card «Категории» (prototype, CAL-04): what each color of the calendar means, one
 * chip per category in the colors of its pills. Built from `CATEGORY_PALETTE`, the only
 * place with these colors (FD-62).
 */
@Component({
  selector: 'tp-category-legend',
  template: `
    <h2>Категории</h2>
    <ul class="chips">
      @for (item of items; track item.label) {
        <li class="chip" [style.background]="item.bg" [style.color]="item.fg">{{ item.label }}</li>
      }
    </ul>
  `,
  styleUrl: './category-legend.scss',
})
export class CategoryLegend {
  protected readonly items = EVENT_CATEGORIES.map((key) => CATEGORY_PALETTE[key]);
}
