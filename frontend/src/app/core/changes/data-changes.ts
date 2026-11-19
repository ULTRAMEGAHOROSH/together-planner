// "The data changed" notices (FD-28): whoever changes events or templates calls
// `eventsChanged()` / `templatesChanged()`, stores listen and re-read from the server
// themselves (FD-27). Nothing is remembered: a store created later just loads.
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DataChanges {
  private readonly events = new Subject<void>();
  private readonly templates = new Subject<void>();

  /** Emits after events were created, changed or deleted, or a template was applied. */
  readonly events$ = this.events.asObservable();
  /** Emits after templates were created, changed, deleted or applied. */
  readonly templates$ = this.templates.asObservable();

  eventsChanged(): void {
    this.events.next();
  }

  templatesChanged(): void {
    this.templates.next();
  }
}
