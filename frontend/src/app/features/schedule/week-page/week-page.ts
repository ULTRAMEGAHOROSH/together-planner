import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  input,
  runInInjectionContext,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import type { IsoDate } from '@core/api/models/common.models';
import { ViewContext } from '@core/view/view-context';
import { isMonday, parseDate, weekStartOf } from '@shared/time';
import { ScheduleBoard } from '@shared/timeline/board/schedule-board/schedule-board';
import { currentWeekPath } from '../current-week';
import { PartnerPlaceholder } from '../partner-placeholder/partner-placeholder';
import { WeekStore } from '../week-store';

/** The Monday of the week that holds `raw`; `null` when `raw` is not a date at all. */
function mondayOf(raw: string): IsoDate | null {
  try {
    parseDate(raw);
  } catch {
    return null;
  }
  return isMonday(raw) ? raw : weekStartOf(raw);
}

/**
 * `/week/:weekStart` (FD §6): the week of both members on the board. The address always
 * names a Monday: any other day is replaced by the Monday of its week and a malformed one
 * by the current week (`replaceUrl`: no extra history entry). The store loads; this page
 * only connects the address, the store and the board.
 */
@Component({
  selector: 'tp-week-page',
  imports: [ScheduleBoard, PartnerPlaceholder],
  providers: [WeekStore],
  template: `
    @if (members().length > 0) {
      <tp-schedule-board class="board" [panels]="members()" [timeZone]="store.timeZone()">
        @if (partnerMissing()) {
          <tp-partner-placeholder tpPartnerPlaceholder />
        }
      </tp-schedule-board>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-height: 0;
    }
    .board {
      flex: 1 1 0;
      margin: 12px;
    }
  `,
})
export class WeekPage {
  /** The `:weekStart` of the address (component input binding). */
  readonly weekStart = input<string>();

  protected readonly store = inject(WeekStore);
  private readonly router = inject(Router);
  private readonly view = inject(ViewContext);
  private readonly injector = inject(Injector);

  /** Panels of the members that exist; the board draws a placeholder for the missing one. */
  protected readonly members = computed(() =>
    this.store.panels().flatMap((p) => (p.kind === 'member' ? [p.panel] : [])),
  );
  protected readonly partnerMissing = computed(() => this.members().length === 1);

  constructor() {
    effect(() => {
      const raw = this.weekStart();
      if (raw === undefined) {
        return;
      }
      const monday = mondayOf(raw);
      untracked(() => {
        if (monday === raw) {
          this.store.setWeek(monday);
          this.view.setFocusDate(monday);
        } else {
          const target =
            monday === null
              ? runInInjectionContext(this.injector, currentWeekPath)
              : `/week/${monday}`;
          void this.router.navigateByUrl(target, { replaceUrl: true });
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.view.setFocusDate(null));
  }
}
