import { Component, computed, inject, OnInit } from '@angular/core';
import { messageFor } from '@core/error/error-messages';
import type { TemplateApplicationResponse } from '@core/api/models/template.models';
import { SessionStore } from '@core/auth/session-store';
import { ZoneClock } from '@core/time/zone-clock';
import { dayMonthTime, parseInstant, weekShort } from '@shared/time';
import { Button } from '@shared/ui/button/button';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Spinner } from '@shared/ui/spinner/spinner';
import { APPLY_MODE_OPTIONS } from '../apply/apply-params';
import { HistoryStore } from './history-store';

interface HistoryLine {
  readonly id: string;
  readonly text: string;
  readonly meta: string;
}

const MODE_TITLE = Object.fromEntries(APPLY_MODE_OPTIONS.map((o) => [o.mode, o.title]));

/**
 * «Журнал применений» (TPL-10, prototype): «“имя” → неделя 9–15 нояб.», the mode, what was
 * created / skipped / deleted, who and when. The name is the one of the moment of the
 * application: renaming or deleting the template does not touch the line.
 */
@Component({
  selector: 'tp-history-list',
  imports: [Button, ErrorState, Spinner],
  providers: [HistoryStore],
  template: `
    <section class="history" aria-labelledby="tp-history-title">
      <h2 id="tp-history-title">Журнал применений</h2>
      <p class="note">
        Запись хранит название шаблона на момент применения: если шаблон переименовать или удалить,
        история не потеряется.
      </p>
      @if (store.status() === 'error') {
        <tp-error-state [text]="errorText()" (retry)="store.load()" />
      } @else if (store.status() === 'loading' && lines().length === 0) {
        <tp-spinner label="Загружаем журнал…" />
      } @else if (lines().length === 0) {
        <p class="empty">Шаблоны ещё не применяли.</p>
      } @else {
        <ul class="lines">
          @for (line of lines(); track line.id) {
            <li>
              <span class="text">{{ line.text }}</span>
              <span class="meta">{{ line.meta }}</span>
            </li>
          }
        </ul>
        @if (store.error()) {
          <p class="more-error" role="alert">{{ errorText() }}</p>
        }
        @if (store.hasNext()) {
          <button
            tpButton
            variant="ghost"
            size="sm"
            type="button"
            [loading]="store.loadingMore()"
            (click)="store.more()"
          >
            Показать ещё
          </button>
        }
      }
    </section>
  `,
  styles: `
    .history {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      padding: 16px;
      border: 1px solid var(--tp-color-border);
      border-radius: 18px;
      background: var(--tp-color-surface);
    }
    h2 {
      margin: 0;
      font-family: var(--tp-font-display);
      font-size: 15px;
      font-weight: 800;
    }
    .note,
    .empty {
      margin: 0 0 4px;
      font-size: 12.5px;
      color: var(--tp-color-text-subtle);
    }
    .lines {
      align-self: stretch;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      padding: 10px 0;
      border-top: 1px solid var(--tp-color-border);
    }
    .text {
      flex: 1 1 260px;
      font-weight: 600;
    }
    .meta {
      font-size: 12.5px;
      color: var(--tp-color-text-subtle);
    }
    .more-error {
      margin: 0;
      font-size: 13px;
      color: var(--tp-color-danger);
    }
  `,
})
export class HistoryList implements OnInit {
  protected readonly store = inject(HistoryStore);
  private readonly session = inject(SessionStore);
  private readonly clock = inject(ZoneClock);

  protected readonly errorText = computed(() => messageFor(this.store.error()));
  protected readonly lines = computed<readonly HistoryLine[]>(() =>
    this.store.items().map((item) => this.lineOf(item)),
  );

  ngOnInit(): void {
    this.store.load();
  }

  private lineOf(item: TemplateApplicationResponse): HistoryLine {
    const counts = [`создано ${item.createdCount}`];
    if (item.skippedCount > 0) counts.push(`пропущено ${item.skippedCount}`);
    if (item.deletedCount > 0) counts.push(`удалено ${item.deletedCount}`);
    const who =
      this.session.members().find((m) => m.userId === item.appliedBy)?.displayName ?? 'Участник';
    return {
      id: item.id,
      text: `«${item.templateName}» → неделя ${weekShort(item.weekStart)}`,
      meta: [
        MODE_TITLE[item.mode],
        counts.join(', '),
        `${who}, ${this.whenOf(item.appliedAt)}`,
      ].join(' · '),
    };
  }

  private whenOf(instant: string): string {
    const zone = this.session.timeZone() ?? 'UTC';
    return dayMonthTime(this.clock.nowIn(zone, parseInstant(instant)));
  }
}
