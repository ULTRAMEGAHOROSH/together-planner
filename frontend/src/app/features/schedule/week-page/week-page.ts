import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  input,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import type { IsoDate } from '@core/api/models/common.models';
import { SessionStore } from '@core/auth/session-store';
import { ZoneClock } from '@core/time/zone-clock';
import { ViewContext } from '@core/view/view-context';
import { isMonday, parseDate, weekStartOf } from '@shared/time';
import { ScheduleBoard } from '@shared/timeline/board/schedule-board/schedule-board';
import { currentWeekPath, currentWeekStart } from '../current-week';
import { PartnerPlaceholder } from '../partner-placeholder/partner-placeholder';
import { WeekStore } from '../week-store';
import { WeekToolbar, type WeekView } from '../week-toolbar/week-toolbar';

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
  imports: [ScheduleBoard, PartnerPlaceholder, WeekToolbar],
  providers: [WeekStore],
  template: `
    @if (store.weekStart(); as weekStart) {
      <tp-week-toolbar
        [weekStart]="weekStart"
        [currentWeek]="currentWeek()"
        [appliedTemplates]="store.appliedTemplates()"
        [view]="mode()"
        (viewChange)="mode.set($event)"
        (weekChange)="show($event)"
      />
    }
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
  private readonly session = inject(SessionStore);
  private readonly clock = inject(ZoneClock);

  /** «Неделя / День»; what «День» does is WEEK-13. */
  protected readonly mode = signal<WeekView>('week');
  /** The Monday of the current week; it moves on at midnight in the workspace zone. */
  protected readonly currentWeek = computed(() =>
    currentWeekStart(this.session.timeZone(), this.clock, this.clock.minuteTick()),
  );

  /** Panels of the members that exist; the board draws a placeholder for the missing one. */
  protected readonly members = computed(() =>
    this.store.panels().flatMap((p) => (p.kind === 'member' ? [p.panel] : [])),
  );
  protected readonly partnerMissing = computed(() => this.members().length === 1);

  /** Goes to the week with that Monday: a history entry, so «Назад» returns to this one. */
  protected show(weekStart: IsoDate): void {
    void this.router.navigateByUrl(`/week/${weekStart}`);
  }

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
