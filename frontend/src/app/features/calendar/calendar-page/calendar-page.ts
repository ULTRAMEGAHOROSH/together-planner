import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, DestroyRef, effect, inject, input, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import type { IsoDate } from '@core/api/models/common.models';
import { SessionStore } from '@core/auth/session-store';
import { messageFor } from '@core/error/error-messages';
import { ViewContext } from '@core/view/view-context';
import { EventEditor } from '@features/events';
import { weekUrl } from '@features/schedule';
import { addDays, weekStartOf } from '@shared/time';
import { NARROW_BREAKPOINT } from '@shared/timeline/engine/constants';
import { Button } from '@shared/ui/button/button';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Icon } from '@shared/ui/icon/icon';
import { CalendarStore } from '../calendar-store';
import { CategoryLegend } from '../category-legend/category-legend';
import { MonthGrid } from '../month-grid/month-grid';
import { UpcomingList } from '../upcoming-list/upcoming-list';
import { UpcomingStore } from '../upcoming-store';
import {
  calendarUrl,
  firstOfMonth,
  monthLabel,
  monthOf,
  resolveMonth,
  shiftMonth,
  type IsoMonth,
} from '../month';

/** «+ Запланировать на будущее» starts in three weeks at 10:00 (prototype `newFuture`). */
const FUTURE_DAYS = 21;
const FUTURE_MINUTE = 10 * 60;

/** Below this width the cells are shorter (the same border as the week board). */
const NARROW_QUERY = `(max-width: ${NARROW_BREAKPOINT - 0.02}px)`;

/**
 * `/calendar?month=YYYY-MM` (FD §6, CAL-01): the month as a grid of days. The address is
 * always canonical — a month, anything else is replaced by the current one (`replaceUrl`).
 * The store loads; this page connects the address, the store and the grid, and leads from a
 * day to its week and from a pill to the event editor.
 */
@Component({
  selector: 'tp-calendar-page',
  imports: [Button, Icon, MonthGrid, ErrorState, UpcomingList, CategoryLegend],
  providers: [CalendarStore, UpcomingStore],
  template: `
    @if (refreshing()) {
      <div class="progress" role="progressbar" aria-label="Загружаем месяц…"></div>
    }
    @if (shownMonth(); as current) {
      <header class="toolbar">
        <div class="nav">
          <button
            tpButton
            class="arrow"
            variant="ghost"
            size="sm"
            type="button"
            aria-label="Предыдущий месяц"
            (click)="go(current, -1)"
          >
            <tp-icon name="chevron-left" [size]="18" />
          </button>
          <button
            tpButton
            class="arrow"
            variant="ghost"
            size="sm"
            type="button"
            aria-label="Следующий месяц"
            (click)="go(current, 1)"
          >
            <tp-icon name="chevron-right" [size]="18" />
          </button>
          <button
            tpButton
            class="today"
            variant="ghost"
            size="sm"
            type="button"
            [disabled]="current === currentMonth()"
            (click)="goToday()"
          >
            Сегодня
          </button>
        </div>
        <h1>{{ title(current) }}</h1>
      </header>
      @if (store.status() === 'error') {
        <tp-error-state class="notice" [text]="errorText()" (retry)="store.reload()" />
      }
      <div class="layout">
        <div class="main">
          @if (store.days().length > 0) {
            <tp-month-grid
              class="grid"
              [days]="store.days()"
              [narrow]="narrow()"
              (dayClick)="openDay($event)"
              (eventClick)="edit($event)"
            />
          } @else if (store.status() === 'loading') {
            <div class="skeleton" role="status" aria-label="Загружаем месяц…"></div>
          }
        </div>
        <aside class="side">
          <tp-upcoming-list
            [events]="upcoming.events()"
            [members]="members()"
            [today]="upcoming.today()"
            [loading]="upcoming.status() === 'loading' && upcoming.events().length === 0"
            [errorText]="upcomingError()"
            (open)="editUpcoming($event)"
            (create)="planFuture()"
            (retry)="upcoming.reload()"
          />
          <tp-category-legend />
        </aside>
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      padding-bottom: 20px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px 16px;
      padding: 14px 20px 10px;
    }
    .nav {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .arrow {
      width: 40px;
      padding: 0;
    }
    // Prototype: «Сегодня» is accent-coloured while it leads somewhere, grey on the current month.
    .today:not(:disabled) {
      color: var(--tp-color-accent);
    }
    h1 {
      margin: 0;
      font-family: var(--tp-font-display);
      font-size: 21px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .notice {
      margin: 0 20px 10px;
    }
    // The grid and the side card (prototype): the card goes below on a narrow screen.
    .layout {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 16px;
      padding: 0 20px;
    }
    .main {
      flex: 3 1 560px;
      min-width: 0;
    }
    .side {
      display: flex;
      flex: 1 1 300px;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }
    .skeleton {
      min-height: 420px;
      background: var(--tp-color-surface);
      border: 1px solid var(--tp-color-border-card);
      border-radius: var(--tp-radius-lg);
      animation: calendarPulse 1.4s ease-in-out infinite;
    }
    @keyframes calendarPulse {
      50% {
        opacity: 0.45;
      }
    }
    // A thin strip over the page while the next month loads: the old grid stays.
    .progress {
      position: absolute;
      inset: 0 0 auto;
      z-index: 30;
      height: 3px;
      overflow: hidden;
      background: var(--tp-color-accent-ring);

      &::after {
        content: '';
        display: block;
        width: 35%;
        height: 100%;
        background: var(--tp-color-accent);
        animation: calendarProgress 1.1s ease-in-out infinite;
      }
    }
    @keyframes calendarProgress {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(290%);
      }
    }
    @media (max-width: 819.98px) {
      .toolbar {
        padding: 10px 12px 8px;
      }
      .layout {
        padding: 0 12px;
      }
      .notice {
        margin-inline: 12px;
      }
    }
  `,
})
export class CalendarPage {
  /** The `?month=` of the address (component input binding). */
  readonly month = input<string | undefined>();

  protected readonly store = inject(CalendarStore);
  protected readonly upcoming = inject(UpcomingStore);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly viewContext = inject(ViewContext);
  private readonly editor = inject(EventEditor);
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly narrow = toSignal(
    this.breakpoints.observe(NARROW_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(NARROW_QUERY) },
  );

  /** The month of «today» in the workspace zone; the address falls back to it. */
  protected readonly currentMonth = computed(() => monthOf(this.store.today()));

  private readonly resolved = computed(() => resolveMonth(this.month(), this.currentMonth()));
  /** The month of the address once it is canonical (while it is being replaced — `null`). */
  protected readonly shownMonth = computed<IsoMonth | null>(() => {
    const resolved = this.resolved();
    return resolved.canonical ? resolved.month : null;
  });
  protected readonly members = this.session.members;
  protected readonly upcomingError = computed(() =>
    this.upcoming.status() === 'error' ? messageFor(this.upcoming.error()) : null,
  );
  /** The next month is loading and the previous one is still on screen: a thin strip. */
  protected readonly refreshing = computed(
    () => this.store.status() === 'loading' && this.store.days().length > 0,
  );
  protected readonly errorText = computed(() => messageFor(this.store.error()));

  protected title(month: IsoMonth): string {
    return monthLabel(month);
  }

  /** «‹ ›»: a history entry, so «Назад» returns to the month it was. */
  protected go(month: IsoMonth, count: number): void {
    void this.router.navigateByUrl(calendarUrl(shiftMonth(month, count)));
  }

  protected goToday(): void {
    void this.router.navigateByUrl(calendarUrl(this.currentMonth()));
  }

  /** A cell: that day on the week board (the «День» mode). */
  protected openDay(day: IsoDate): void {
    void this.router.navigateByUrl(weekUrl({ weekStart: weekStartOf(day), day }));
  }

  /** A pill: the event of the month on screen, with its version, opens for edit. */
  protected edit(id: string): void {
    const event = this.store.eventById(id);
    if (event) {
      this.editor.openEdit(event);
    }
  }

  /** A row of «Запланировано»: the event, with its version, opens for edit. */
  protected editUpcoming(id: string): void {
    const event = this.upcoming.events().find((e) => e.id === id);
    if (event) {
      this.editor.openEdit(event);
    }
  }

  /** «+ Запланировать на будущее»: in three weeks at 10:00, for both (prototype). */
  protected planFuture(): void {
    const me = this.session.me();
    if (me === null) {
      return;
    }
    this.editor.openCreate({
      date: addDays(this.upcoming.today(), FUTURE_DAYS),
      minute: FUTURE_MINUTE,
      // Alone in the workspace there is nobody to ask along.
      personSeat: this.session.isPartnerMissing() ? me.seat : 'both',
    });
  }

  constructor() {
    effect(() => {
      const resolved = this.resolved();
      if (!resolved.canonical) {
        untracked(
          () => void this.router.navigateByUrl(calendarUrl(resolved.month), { replaceUrl: true }),
        );
      }
    });
    effect(() => {
      const month = this.shownMonth();
      if (month !== null) {
        untracked(() => this.store.showMonth(month));
      }
    });
    // «+ Событие» of the header starts today when it is in the month, else on the 1st.
    effect(() => {
      const month = this.shownMonth();
      if (month !== null) {
        const today = this.store.today();
        untracked(() =>
          this.viewContext.setFocusDate(monthOf(today) === month ? today : firstOfMonth(month)),
        );
      }
    });
    inject(DestroyRef).onDestroy(() => this.viewContext.setFocusDate(null));
  }
}
