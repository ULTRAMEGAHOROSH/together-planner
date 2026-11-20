import { DIALOG_DATA } from '@angular/cdk/dialog';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import type { Observable } from 'rxjs';
import type { IsoDate, Uuid } from '@core/api/models/common.models';
import type { ApplyMode } from '@core/api/models/enums';
import { SessionStore } from '@core/auth/session-store';
import { messageFor } from '@core/error/error-messages';
import { ZoneClock } from '@core/time/zone-clock';
import { plural, relWeek, weekLabel, weekShort, weekStartOf } from '@shared/time';
import { Button } from '@shared/ui/button/button';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { DialogShell } from '@shared/ui/dialog/dialog-shell';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Icon } from '@shared/ui/icon/icon';
import { Spinner } from '@shared/ui/spinner/spinner';
import { TemplatesStore } from '../../templates-store';
import {
  APPLY_MODE_OPTIONS,
  type ApplyParams,
  asksIncludeManual,
  mondayOf,
  shiftWeek,
  toApplyRequest,
  weeksBetween,
} from '../apply-params';

/** What the opener gives: the template to start with (if any) and the week to start with. */
export interface ApplyDialogData {
  templateId?: Uuid;
  /** Any date of the week: the dialog works with its Monday. */
  weekStart: IsoDate;
}

/**
 * «Применить шаблон» (prototype «ДИАЛОГ ПРИМЕНЕНИЯ ШАБЛОНА»): what, where and how. The
 * choice is `params()`; the preview and the apply itself build on it (TPL-06, TPL-07).
 * The templates come from T1 through the store of the dialog.
 */
@Component({
  selector: 'tp-apply-dialog',
  imports: [Button, DialogShell, ErrorState, Icon, Spinner],
  providers: [TemplatesStore],
  templateUrl: './apply-dialog.html',
  styleUrl: './apply-dialog.scss',
})
export class ApplyTemplateDialog implements OnInit {
  protected readonly data = inject<ApplyDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<unknown>>(DialogRef);
  protected readonly store = inject(TemplatesStore);
  private readonly session = inject(SessionStore);
  private readonly clock = inject(ZoneClock);

  protected readonly modes = APPLY_MODE_OPTIONS;

  private readonly pickedTemplate = signal<Uuid | null>(null);
  private readonly weekState = signal<IsoDate>(mondayOf(this.data.weekStart));
  private readonly modeState = signal<ApplyMode>('MERGE');
  private readonly includeManualState = signal(false);

  readonly weekStart = this.weekState.asReadonly();
  readonly mode = this.modeState.asReadonly();
  readonly includeManual = this.includeManualState.asReadonly();

  /** The chosen template: the user's pick, else the one asked for, else the first. */
  readonly templateId = computed<Uuid | null>(() => {
    const templates = this.store.templates();
    const wanted = [this.pickedTemplate(), this.data.templateId ?? null];
    return (
      wanted.find((id) => id !== null && templates.some((t) => t.id === id)) ??
      templates[0]?.id ??
      null
    );
  });

  /** The whole choice; the preview asks the backend with it. */
  readonly params = computed<ApplyParams>(() => ({
    templateId: this.templateId(),
    weekStart: this.weekStart(),
    mode: this.mode(),
    includeManual: asksIncludeManual(this.mode()) && this.includeManual(),
  }));
  /** The T6 / T7 body for the choice. */
  readonly request = computed(() => toApplyRequest(this.params()));

  protected readonly templateOptions = computed(() =>
    this.store.templates().map((t) => ({
      id: t.id,
      name: t.name,
      meta: `${t.events.length} ${plural(t.events.length, 'событие', 'события', 'событий')}`,
    })),
  );
  protected readonly weekText = computed(() => weekShort(this.weekStart()));
  protected readonly weekTitle = computed(() => weekLabel(this.weekStart()));
  /** «Эта неделя», «Следующая неделя»…; empty while the zone is unknown. */
  protected readonly weekRelative = computed(() => {
    const zone = this.session.timeZone();
    if (zone === null) {
      return '';
    }
    const current = weekStartOf(this.clock.todayIn(zone, this.clock.minuteTick()));
    return relWeek(weeksBetween(current, this.weekStart()));
  });
  protected readonly showIncludeManual = computed(() => asksIncludeManual(this.mode()));
  protected readonly errorText = computed(() => messageFor(this.store.error()));
  protected readonly loading = computed(
    () => this.store.templates().length === 0 && ['idle', 'loading'].includes(this.store.status()),
  );
  protected readonly failed = computed(
    () => this.store.status() === 'error' && this.store.templates().length === 0,
  );
  protected readonly noTemplates = computed(
    () => this.store.status() === 'ready' && this.store.templates().length === 0,
  );

  ngOnInit(): void {
    this.store.load();
  }

  protected pickTemplate(id: Uuid): void {
    this.pickedTemplate.set(id);
  }

  protected shiftWeek(weeks: number): void {
    this.weekState.update((week) => shiftWeek(week, weeks));
  }

  protected pickMode(mode: ApplyMode): void {
    this.modeState.set(mode);
    if (!asksIncludeManual(mode)) {
      // The tick does not stay behind a mode that cannot use it.
      this.includeManualState.set(false);
    }
  }

  protected toggleIncludeManual(checked: boolean): void {
    this.includeManualState.set(checked);
  }
}

/** Opens {@link ApplyTemplateDialog}; the dialog is the place of the preview and the apply. */
export function openApplyTemplate(
  dialogs: DialogService,
  data: ApplyDialogData,
): Observable<unknown> {
  return dialogs.open<unknown, ApplyDialogData>(ApplyTemplateDialog, data, { size: 'lg' });
}
