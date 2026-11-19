import { Component, computed, input, model, output } from '@angular/core';
import type { IsoDate } from '@core/api/models/common.models';
import type { TemplateApplicationResponse } from '@core/api/models/template.models';
import { addDays, daysBetween, relWeek, weekLabel } from '@shared/time';
import { Button } from '@shared/ui/button/button';
import { Icon } from '@shared/ui/icon/icon';
import {
  SegmentedControl,
  type SegmentOption,
} from '@shared/ui/segmented-control/segmented-control';

export type WeekView = 'week' | 'day';

const VIEWS: readonly SegmentOption<WeekView>[] = [
  { value: 'week', label: 'Неделя' },
  { value: 'day', label: 'День' },
];

/**
 * The line above the board (prototype): «‹ › Сегодня», the period with what week it is and
 * which templates it was made from, and the «Неделя / День» switch. Presentational: it
 * only says which week to go to (`weekChange`), the page does the navigation. What the
 * «День» mode does is WEEK-13.
 */
@Component({
  selector: 'tp-week-toolbar',
  imports: [Button, Icon, SegmentedControl],
  templateUrl: './week-toolbar.html',
  styleUrl: './week-toolbar.scss',
})
export class WeekToolbar {
  /** Monday of the shown week. */
  readonly weekStart = input.required<IsoDate>();
  /** Monday of the current week in the workspace zone. */
  readonly currentWeek = input.required<IsoDate>();
  /** Applications of templates to the shown week. */
  readonly appliedTemplates = input<readonly TemplateApplicationResponse[]>([]);
  readonly view = model<WeekView>('week');
  /** The Monday of the week the user asked for. */
  readonly weekChange = output<IsoDate>();

  protected readonly views = VIEWS;
  protected readonly title = computed(() => weekLabel(this.weekStart()));
  protected readonly isCurrent = computed(() => this.weekStart() === this.currentWeek());
  /** «Эта неделя · шаблон «Обычная неделя»». */
  protected readonly subtitle = computed(() => {
    const relative = relWeek(daysBetween(this.currentWeek(), this.weekStart()) / 7);
    // One template applied twice (MERGE, then REPLACE) is named once.
    const names = [...new Set(this.appliedTemplates().map((a) => a.templateName))];
    return names.length === 0 ? relative : `${relative} · шаблон «${names.join('», «')}»`;
  });

  protected go(weeks: number): void {
    this.weekChange.emit(addDays(this.weekStart(), weeks * 7));
  }

  protected goToday(): void {
    this.weekChange.emit(this.currentWeek());
  }
}
