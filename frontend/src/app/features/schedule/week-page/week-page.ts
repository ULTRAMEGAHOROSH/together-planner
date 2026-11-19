import { BreakpointObserver } from '@angular/cdk/layout';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import type { IsoDate } from '@core/api/models/common.models';
import { SessionStore } from '@core/auth/session-store';
import { messageFor } from '@core/error/error-messages';
import { ZoneClock } from '@core/time/zone-clock';
import { ViewContext } from '@core/view/view-context';
import { weekStartOf } from '@shared/time';
import { NARROW_BREAKPOINT } from '@shared/timeline/engine/constants';
import { ScheduleBoard } from '@shared/timeline/board/schedule-board/schedule-board';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { DayChips } from '../day-chips/day-chips';
import { PartnerPlaceholder } from '../partner-placeholder/partner-placeholder';
import { resolveAddress, type WeekAddress, weekUrl } from '../week-address';
import { WeekStore } from '../week-store';
import { WeekToolbar } from '../week-toolbar/week-toolbar';
import { WeekViewPreference, type WeekView } from '../week-view-preference';

/** Below this width only «День» fits (FD-60, prototype: `window.innerWidth < 820`). */
const NARROW_QUERY = `(max-width: ${NARROW_BREAKPOINT - 0.02}px)`;

/**
 * `/week/:weekStart?day=` (FD §6, §8.2): the week of both members on the board, or one day
 * of it. The address is always canonical — a Monday, and a `day` only if it is a date of
 * that week; anything else is replaced (`replaceUrl`: no extra history entry). The mode is
 * «День» when the address has a `day`, on a screen below 820 px, or when the user chose it
 * last (FD-47); otherwise «Неделя». The store loads; this page only connects the address,
 * the store and the board.
 */
@Component({
  selector: 'tp-week-page',
  imports: [ScheduleBoard, PartnerPlaceholder, WeekToolbar, DayChips, EmptyState, ErrorState],
  providers: [WeekStore],
  template: `
    @if (refreshing()) {
      <div class="progress" role="progressbar" aria-label="Загружаем неделю…"></div>
    }
    @if (store.weekStart(); as weekStart) {
      <tp-week-toolbar
        [weekStart]="weekStart"
        [day]="selectedDay()"
        [today]="today()"
        [appliedTemplates]="store.appliedTemplates()"
        [canChooseView]="!narrow()"
        [view]="mode()"
        (viewChange)="chooseView(weekStart, $event)"
        (navigate)="show($event)"
      />
      @if (selectedDay(); as day) {
        <tp-day-chips
          [weekStart]="weekStart"
          [selectedDay]="day"
          [today]="today()"
          (dayChange)="show({ weekStart, day: $event })"
        />
      }
      @if (store.status() === 'error') {
        <tp-error-state class="notice" [text]="errorText()" (retry)="store.reload()" />
      }
      @if (store.isEmpty()) {
        <tp-empty-state
          class="notice"
          text="На эту неделю пока ничего нет. Будущие события появятся здесь сами, а типовую неделю можно взять из шаблона."
        />
      }
      @if (members().length > 0) {
        <tp-schedule-board
          class="board"
          [panels]="members()"
          [timeZone]="store.timeZone()"
          [dayNavigation]="!narrow()"
          (dayClick)="toggleDay(weekStart, $event)"
        >
          @if (partnerMissing()) {
            <tp-partner-placeholder tpPartnerPlaceholder />
          }
        </tp-schedule-board>
      } @else if (firstLoad()) {
        <div class="board skeleton" role="status" aria-label="Загружаем неделю…">
          <div class="column"></div>
          <div class="gutter"></div>
          <div class="column"></div>
        </div>
      }
    }
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-height: 0;
    }
    .board {
      flex: 1 1 0;
      margin: 12px;
    }
    .notice {
      margin: 0 20px 10px;
    }
    // A thin strip over the page while the next week loads: the old board stays and nothing
    // moves (it floats above the toolbar).
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
        animation: weekProgress 1.1s ease-in-out infinite;
      }
    }
    @keyframes weekProgress {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(290%);
      }
    }
    // The first load: the frame of the board, so that the page does not jump when it arrives.
    .skeleton {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 56px minmax(0, 1fr);
      overflow: hidden;
      background: var(--tp-color-surface);
      border: 1px solid var(--tp-color-border-card);
      border-radius: var(--tp-radius-board);
    }
    .column {
      // The header (85 px, as on the board), then hour lines.
      background:
        linear-gradient(var(--tp-color-border-subtle) 0 0) 0 85px / 100% 1px no-repeat,
        repeating-linear-gradient(var(--tp-color-border-subtle) 0 1px, transparent 1px 40px) 0
          85px / 100% 100% no-repeat;
      border-top: 3px solid var(--tp-color-border);
      animation: weekPulse 1.4s ease-in-out infinite;
    }
    @keyframes weekPulse {
      50% {
        opacity: 0.45;
      }
    }
  `,
})
export class WeekPage {
  /** The `:weekStart` of the address (component input binding). */
  readonly weekStart = input<string>();
  /** The `?day=` of the address. */
  readonly day = input<string>();

  protected readonly store = inject(WeekStore);
  private readonly router = inject(Router);
  private readonly viewContext = inject(ViewContext);
  private readonly session = inject(SessionStore);
  private readonly clock = inject(ZoneClock);
  private readonly preference = inject(WeekViewPreference);
  private readonly breakpoints = inject(BreakpointObserver);

  /** Below 820 px: only «День», no switch, the day headers are labels. */
  protected readonly narrow = toSignal(
    this.breakpoints.observe(NARROW_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(NARROW_QUERY) },
  );
  /** What the user chose last on a wide screen (FD-47). */
  private readonly preferred = signal<WeekView>(this.preference.read());

  /** «Today» in the workspace zone; moves on at midnight there. */
  protected readonly today = computed(() =>
    this.clock.todayIn(this.session.timeZone() ?? 'UTC', this.clock.minuteTick()),
  );
  private readonly currentWeek = computed(() => weekStartOf(this.today()));

  /** The address put right; `null` until the input is there. */
  private readonly resolved = computed(() => {
    const raw = this.weekStart();
    return raw === undefined ? null : resolveAddress(raw, this.day(), this.currentWeek());
  });
  /** The week of the address once it is canonical (while it is being replaced — `null`). */
  private readonly canonicalWeek = computed(() => {
    const resolved = this.resolved();
    return resolved?.canonical ? resolved.address.weekStart : null;
  });
  protected readonly mode = computed<WeekView>(() =>
    this.narrow() || this.resolved()?.address.day || this.preferred() === 'day' ? 'day' : 'week',
  );
  /** The day shown, `null` in «Неделя»; without `?day` — today if it is this week, else Monday. */
  protected readonly selectedDay = computed(() => {
    const week = this.canonicalWeek();
    if (week === null || this.mode() === 'week') {
      return null;
    }
    return this.resolved()?.address.day ?? this.defaultDay(week);
  });

  /** Panels of the members that exist; the board draws a placeholder for the missing one. */
  protected readonly members = computed(() =>
    this.store.panels().flatMap((p) => (p.kind === 'member' ? [p.panel] : [])),
  );
  protected readonly partnerMissing = computed(() => this.members().length === 1);
  /** No week has arrived yet: the skeleton of the board stands in. */
  protected readonly firstLoad = computed(
    () => this.store.status() === 'loading' && this.store.data() === null,
  );
  /** The next week is loading and the previous one is still on screen: a thin strip. */
  protected readonly refreshing = computed(
    () => this.store.status() === 'loading' && this.store.data() !== null,
  );
  protected readonly errorText = computed(() => messageFor(this.store.error()));

  /** Goes to a week (and day): a history entry, so «Назад» returns to where it was. */
  protected show(address: WeekAddress): void {
    void this.router.navigateByUrl(weekUrl(address));
  }

  /** «Неделя / День» of the switch: remembered, and the address follows. */
  protected chooseView(week: IsoDate, view: WeekView): void {
    this.remember(view);
    this.show({ weekStart: week, day: view === 'day' ? this.defaultDay(week) : null });
  }

  /** A day header: opens that day on a week, leads back to the week on an open day. */
  protected toggleDay(week: IsoDate, day: IsoDate): void {
    if (this.mode() === 'day') {
      this.chooseView(week, 'week');
    } else {
      this.remember('day');
      this.show({ weekStart: week, day });
    }
  }

  private remember(view: WeekView): void {
    this.preferred.set(view);
    this.preference.write(view);
  }

  private defaultDay(week: IsoDate): IsoDate {
    return this.currentWeek() === week ? this.today() : week;
  }

  constructor() {
    effect(() => {
      const resolved = this.resolved();
      if (resolved !== null && !resolved.canonical) {
        untracked(
          () => void this.router.navigateByUrl(weekUrl(resolved.address), { replaceUrl: true }),
        );
      }
    });
    effect(() => {
      const week = this.canonicalWeek();
      if (week !== null) {
        untracked(() => this.store.setWeek(week));
      }
    });
    effect(() => {
      const week = this.canonicalWeek();
      const day = this.selectedDay();
      if (week !== null) {
        untracked(() => {
          this.store.selectDay(day);
          this.viewContext.setFocusDate(day ?? week);
        });
      }
    });
    inject(DestroyRef).onDestroy(() => this.viewContext.setFocusDate(null));
  }
}
