// What the user is looking at, for things outside the page that act on it: «+ Событие» in
// the header starts on `focusDate` (EVT-04). The page sets it and clears it when it goes.
import { Injectable, signal } from '@angular/core';
import type { IsoDate } from '../api/models/common.models';

@Injectable({ providedIn: 'root' })
export class ViewContext {
  private readonly focus = signal<IsoDate | null>(null);

  /** The day the screen is about: the selected day or the Monday of the week; `null` — none. */
  readonly focusDate = this.focus.asReadonly();

  setFocusDate(date: IsoDate | null): void {
    this.focus.set(date);
  }
}
