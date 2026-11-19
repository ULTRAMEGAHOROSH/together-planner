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
import { messageFor } from '@core/error/error-messages';
import { ViewContext } from '@core/view/view-context';
import { isMonday, parseDate, weekStartOf } from '@shared/time';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { ErrorState } from '@shared/ui/error-state/error-state';
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
  imports: [ScheduleBoard, PartnerPlaceholder, WeekToolbar, EmptyState, ErrorState],
  providers: [WeekStore],
  template: `
    @if (refreshing()) {
      <div class="progress" role="progressbar" aria-label="Загружаем неделю…"></div>
    }
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
      <tp-schedule-board class="board" [panels]="members()" [timeZone]="store.timeZone()">
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
  /** No week has arrived yet: the skeleton of the board stands in. */
  protected readonly firstLoad = computed(
    () => this.store.status() === 'loading' && this.store.data() === null,
  );
  /** The next week is loading and the previous one is still on screen: a thin strip. */
  protected readonly refreshing = computed(
    () => this.store.status() === 'loading' && this.store.data() !== null,
  );
  protected readonly errorText = computed(() => messageFor(this.store.error()));

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
