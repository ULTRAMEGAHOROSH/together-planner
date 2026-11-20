import { Component, computed, inject, input } from '@angular/core';
import type { ApplyPreviewResponse, PlannedEvent } from '@core/api/models/template.models';
import type { EventResponse } from '@core/api/models/event.models';
import { SessionStore } from '@core/auth/session-store';
import { whoText } from '@shared/domain';
import { capitalize, dateLong, plural, rangeText } from '@shared/time';
import { Spinner } from '@shared/ui/spinner/spinner';
import type { PreviewStatus } from '../apply-preview-store';

/** One line of a list: when, what and for whom. */
interface Line {
  key: string;
  when: string;
  title: string;
  who: string;
}

interface Day {
  key: string;
  label: string;
  lines: Line[];
}

/**
 * The plan of the backend as the user sees it (TPL-06): counters, what will be added by
 * days, what is skipped and why, the overlaps, and for «Заменить» what is deleted and what
 * comes back. Everything is read off the response `preview`; nothing is worked out here.
 */
@Component({
  selector: 'tp-apply-preview',
  imports: [Spinner],
  templateUrl: './apply-preview.html',
  styleUrl: './apply-preview.scss',
})
export class ApplyPreviewView {
  readonly preview = input<ApplyPreviewResponse | null>(null);
  readonly status = input<PreviewStatus>('idle');
  /** The text of a failed T6, shown inside the dialog. */
  readonly errorText = input<string | null>(null);
  /** «Заменить» with the tick: manual events are in `toDelete`, not «останутся». */
  readonly manualDeleted = input(false);

  private readonly members = inject(SessionStore).members;

  private who(participantIds: readonly string[]): string {
    return whoText(participantIds, this.members());
  }

  private lineOf(event: PlannedEvent | EventResponse, key: string): Line {
    return {
      key,
      when: rangeText(event.start, event.end),
      title: event.title,
      who: this.who(event.participantIds),
    };
  }

  private linesOf(events: readonly PlannedEvent[]): Line[] {
    return events.map((e) => this.lineOf(e, e.templateEventId));
  }

  protected readonly loading = computed(() => this.status() === 'loading');

  protected readonly stats = computed(() => {
    const preview = this.preview();
    if (preview === null) {
      return [];
    }
    const stats = [
      {
        key: 'create',
        label: 'будет добавлено',
        value: `+${preview.toCreate.length}`,
        tone: 'good',
      },
      {
        key: 'applied',
        label: 'пропущено: уже созданы из этого шаблона',
        value: String(preview.skippedAlreadyApplied.length),
        tone: 'plain',
      },
    ];
    if (preview.mode === 'FILL') {
      stats.push({
        key: 'busy',
        label: 'пропущено: у участника день уже занят',
        value: String(preview.skippedBusy.length),
        tone: 'plain',
      });
    }
    if (preview.mode === 'REPLACE') {
      stats.push({
        key: 'delete',
        label: 'будет удалено',
        value: `−${preview.toDelete.length}`,
        tone: 'bad',
      });
    }
    return stats;
  });

  /** Nothing to add and nothing to delete: the backend's plan is empty. */
  protected readonly nothing = computed(() => {
    const preview = this.preview();
    return preview !== null && preview.toCreate.length === 0 && preview.toDelete.length === 0;
  });

  /** What will be added, by the day it starts, in the order the backend gave. */
  protected readonly days = computed<Day[]>(() => {
    const days: Day[] = [];
    for (const event of this.preview()?.toCreate ?? []) {
      const key = event.start.slice(0, 10);
      let day = days.find((d) => d.key === key);
      if (day === undefined) {
        day = { key, label: capitalize(dateLong(key)), lines: [] };
        days.push(day);
      }
      day.lines.push(this.lineOf(event, event.templateEventId));
    }
    return days;
  });

  protected readonly applied = computed(() =>
    this.linesOf(this.preview()?.skippedAlreadyApplied ?? []),
  );
  protected readonly deleted = computed(() => this.linesOf(this.preview()?.skippedDeleted ?? []));
  protected readonly busy = computed(() => this.linesOf(this.preview()?.skippedBusy ?? []));
  protected readonly restored = computed(() => this.linesOf(this.preview()?.restoredDeleted ?? []));
  protected readonly toDelete = computed<Line[]>(() =>
    (this.preview()?.toDelete ?? []).map((e) => this.lineOf(e, e.id)),
  );
  protected readonly conflicts = computed(() =>
    (this.preview()?.conflicts ?? []).map((c, index) => ({
      key: `${c.planned.templateEventId}-${c.existing.id}-${index}`,
      planned: this.lineOf(c.planned, c.planned.templateEventId),
      existing: c.existing.title,
    })),
  );

  protected readonly manualHint = computed(() => {
    const count = this.preview()?.manualEventsInWeek ?? 0;
    return count > 0 && !this.manualDeleted()
      ? `${count} ${plural(count, 'событие, созданное', 'события, созданных', 'событий, созданных')} вручную, ${plural(count, 'останется', 'останутся', 'останутся')}`
      : null;
  });

  protected readonly nothingText = computed(() => {
    const preview = this.preview();
    return preview !== null && preview.skippedAlreadyApplied.length > 0
      ? 'Этот шаблон уже применён к этой неделе. Повторное применение ничего не продублирует.'
      : 'Добавлять нечего: в эти дни у участников уже есть планы.';
  });
}
