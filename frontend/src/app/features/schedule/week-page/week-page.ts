import { Component, input } from '@angular/core';

// Placeholder (FND-05). Real page: WEEK-10.
@Component({
  selector: 'tp-week-page',
  template: `
    <h1>Расписание</h1>
    @if (weekStart(); as start) {
      <p>Неделя с {{ start }}</p>
    }
  `,
})
export class WeekPage {
  readonly weekStart = input<string>();
}
