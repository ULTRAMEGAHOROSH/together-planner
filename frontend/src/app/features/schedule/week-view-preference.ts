import { Injectable } from '@angular/core';

export type WeekView = 'week' | 'day';

const KEY = 'tp.week.view';

/**
 * «Неделя» or «День» as the user last chose it on a wide screen (FD-47): kept in
 * `localStorage`, which may be missing or refuse (private window, blocked site data), so
 * every access is guarded and the answer without it is «Неделя».
 */
@Injectable({ providedIn: 'root' })
export class WeekViewPreference {
  read(): WeekView {
    try {
      return localStorage.getItem(KEY) === 'day' ? 'day' : 'week';
    } catch {
      return 'week';
    }
  }

  write(view: WeekView): void {
    try {
      localStorage.setItem(KEY, view);
    } catch {
      // Not remembered; the choice still holds until the page is closed.
    }
  }
}
