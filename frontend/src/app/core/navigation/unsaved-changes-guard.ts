// Leaving a page with unsaved edits (TPL-04): the page asks, the route only connects it.
import type { CanDeactivateFn } from '@angular/router';
import type { Observable } from 'rxjs';

export interface HasUnsavedChanges {
  /** `true` — leave. Asks the user if there is something to lose. */
  confirmLeave(): boolean | Observable<boolean>;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (page) =>
  page.confirmLeave();
