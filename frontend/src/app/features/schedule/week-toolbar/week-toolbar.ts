import { Component, computed, input, output } from '@angular/core';
import type { IsoDate } from '@core/api/models/common.models';
import type { TemplateApplicationResponse } from '@core/api/models/template.models';
import {
  addDays,
  capitalize,
  dateLong,
  daysBetween,
  relWeek,
  weekLabel,
  weekStartOf,
} from '@shared/time';
import { Button } from '@shared/ui/button/button';
import { Icon } from '@shared/ui/icon/icon';
import {
  SegmentedControl,
  type SegmentOption,
} from '@shared/ui/segmented-control/segmented-control';
import { shiftDay, type WeekAddress } from '../week-address';
import type { WeekView } from '../week-view-preference';

const VIEWS: readonly SegmentOption<WeekView>[] = [
  { value: 'week', label: 'Неделя' },
  { value: 'day', label: 'День' },
];

/**
 * The line above the board (prototype): «‹ ›» and «Сегодня», the period with what it is
 * and which templates the week was made from, and the «Неделя / День» switch. In «День» the
 * arrows step by a day (across the border of the week), the title is the day.
 * Presentational: it only says where to go (`navigate`), the page does the navigation.
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
  /** The shown day in «День»; `null` — the whole week. */
  readonly day = input<IsoDate | null>(null);
  /** «Today» in the workspace zone. */
  readonly today = input.required<IsoDate>();
  /** Applications of templates to the shown week. */
  readonly appliedTemplates = input<readonly TemplateApplicationResponse[]>([]);
  /** The switch is hidden where only «День» is possible (a narrow screen). */
  readonly canChooseView = input(true);
  readonly view = input<WeekView>('week');
  readonly viewChange = output<WeekView>();
  /** The week (and day) the user asked for. */
  readonly navigate = output<WeekAddress>();

  protected readonly views = VIEWS;
  protected readonly title = computed(() => {
    const day = this.day();
    return day === null ? weekLabel(this.weekStart()) : capitalize(dateLong(day));
  });
  protected readonly isCurrent = computed(() => {
    const day = this.day();
    return day === null ? this.weekStart() === weekStartOf(this.today()) : day === this.today();
  });
  /** «Эта неделя · шаблон «Обычная неделя»»; in «День» the period of the week instead. */
  protected readonly subtitle = computed(() => {
    const day = this.day();
    const base =
      day === null
        ? relWeek(daysBetween(weekStartOf(this.today()), this.weekStart()) / 7)
        : weekLabel(this.weekStart());
    // One template applied twice (MERGE, then REPLACE) is named once.
    const names = [...new Set(this.appliedTemplates().map((a) => a.templateName))];
    return names.length === 0 ? base : `${base} · шаблон «${names.join('», «')}»`;
  });

  protected go(step: -1 | 1): void {
    const day = this.day();
    this.navigate.emit(
      day === null
        ? { weekStart: addDays(this.weekStart(), step * 7), day: null }
        : shiftDay(day, step),
    );
  }

  protected goToday(): void {
    const today = this.today();
    this.navigate.emit({
      weekStart: weekStartOf(today),
      day: this.day() === null ? null : today,
    });
  }
}
