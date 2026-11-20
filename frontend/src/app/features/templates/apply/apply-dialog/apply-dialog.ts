import { DIALOG_DATA } from '@angular/cdk/dialog';
import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { Router } from '@angular/router';
import { finalize, type Observable } from 'rxjs';
import type { IsoDate, Uuid } from '@core/api/models/common.models';
import type { ApplyMode } from '@core/api/models/enums';
import type { ApplyPreviewResponse } from '@core/api/models/template.models';
import { TemplatesApi } from '@core/api/templates-api';
import { SessionStore } from '@core/auth/session-store';
import { DataChanges } from '@core/changes/data-changes';
import { isApiError } from '@core/error/api-error';
import { messageFor } from '@core/error/error-messages';
import { ToastService } from '@core/notify/toast-service';
import { weekUrl } from '@features/schedule';
import { ZoneClock } from '@core/time/zone-clock';
import { plural, rangeText, relWeek, weekLabel, weekShort, weekStartOf } from '@shared/time';
import { Button } from '@shared/ui/button/button';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { DialogShell } from '@shared/ui/dialog/dialog-shell';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Icon } from '@shared/ui/icon/icon';
import { Spinner } from '@shared/ui/spinner/spinner';
import { TemplatesStore } from '../../templates-store';
import { ApplyPreviewStore } from '../apply-preview-store';
import { ApplyPreviewView } from '../apply-preview/apply-preview';
import {
  APPLY_MODE_OPTIONS,
  type ApplyParams,
  applyResultText,
  asksIncludeManual,
  mondayOf,
  sameParams,
  shiftWeek,
  toApplyRequest,
  toConfirmedRequest,
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
  imports: [ApplyPreviewView, Button, DialogShell, ErrorState, Icon, Spinner],
  providers: [TemplatesStore, ApplyPreviewStore],
  templateUrl: './apply-dialog.html',
  styleUrl: './apply-dialog.scss',
})
export class ApplyTemplateDialog implements OnInit {
  protected readonly data = inject<ApplyDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<unknown>>(DialogRef);
  protected readonly store = inject(TemplatesStore);
  protected readonly previewStore = inject(ApplyPreviewStore);
  private readonly session = inject(SessionStore);
  private readonly clock = inject(ZoneClock);
  private readonly api = inject(TemplatesApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly changes = inject(DataChanges);

  protected readonly modes = APPLY_MODE_OPTIONS;

  private readonly pickedTemplate = signal<Uuid | null>(null);
  private readonly weekState = signal<IsoDate>(mondayOf(this.data.weekStart));
  private readonly modeState = signal<ApplyMode>('MERGE');
  private readonly includeManualState = signal(false);
  private readonly applyingState = signal(false);
  private readonly outdatedState = signal(false);
  /** The plan the user was asked to confirm («Заменить»); shown only while it is still on screen. */
  private readonly confirmingState = signal<ApplyPreviewResponse | null>(null);

  readonly weekStart = this.weekState.asReadonly();
  readonly mode = this.modeState.asReadonly();
  readonly includeManual = this.includeManualState.asReadonly();
  readonly applying = this.applyingState.asReadonly();
  /** The week changed under the plan (409): the plan was asked for again. */
  readonly outdated = this.outdatedState.asReadonly();

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

  /** Text of a failed T6, shown inside the dialog under the choice. */
  protected readonly previewError = computed(() => {
    const error = this.previewStore.error();
    return error === null ? null : messageFor(error);
  });
  /** «Заменить» with the tick: the manual events are deleted, not kept. */
  protected readonly manualDeleted = computed(
    () => this.mode() === 'REPLACE' && this.includeManual(),
  );
  /** «(n)» after the tick, from the plan of the backend once it is there. */
  protected readonly manualCount = computed(
    () => this.previewStore.preview()?.manualEventsInWeek ?? null,
  );

  /**
   * The plan on screen, only if it is the plan of the choice on screen and has arrived:
   * what «Применить» may apply. Never an old plan, never one of another choice.
   */
  private readonly plan = computed(() => {
    const preview = this.previewStore.preview();
    return this.previewStore.status() === 'ready' &&
      preview !== null &&
      sameParams(this.previewStore.previewParams(), this.params())
      ? preview
      : null;
  });
  /** There is something to do: the backend plans to add or to delete. */
  protected readonly canApply = computed(() => {
    const plan = this.plan();
    return plan !== null && (plan.toCreate.length > 0 || plan.toDelete.length > 0);
  });
  protected readonly applyLabel = computed(() => {
    const plan = this.plan();
    if (plan === null) {
      return 'Применить';
    }
    return this.mode() === 'REPLACE'
      ? `Заменить: −${plan.toDelete.length} / +${plan.toCreate.length}`
      : `Применить: +${plan.toCreate.length}`;
  });
  /** The question before «Заменить»: only for the plan that was asked about, while it is on screen. */
  protected readonly confirmation = computed(() => {
    const asked = this.confirmingState();
    const plan = this.plan();
    if (asked === null || asked !== plan) {
      return null;
    }
    const when = (e: { start: string; end: string; title: string }) =>
      `${rangeText(e.start, e.end)} «${e.title}»`;
    return {
      toDelete: asked.toDelete.map(when),
      restored: asked.restoredDeleted.map(when),
    };
  });

  constructor() {
    // Any change of the choice asks T6 again (debounced and cancelling in the store).
    effect(() => {
      const params = this.params();
      untracked(() => {
        // A new choice is a new question: the old notice and the old confirmation go.
        this.outdatedState.set(false);
        this.confirmingState.set(null);
        this.previewStore.request(params);
      });
    });
  }

  ngOnInit(): void {
    this.store.load();
  }

  /**
   * «Применить». «Заменить» with something to delete or to bring back first asks, listing
   * both; the second press (`confirmApply`) sends T7 with exactly those ids.
   */
  protected apply(): void {
    const plan = this.plan();
    if (plan === null || !this.canApply() || this.applying()) {
      return;
    }
    if (
      this.mode() === 'REPLACE' &&
      (plan.toDelete.length > 0 || plan.restoredDeleted.length > 0)
    ) {
      this.confirmingState.set(plan);
      return;
    }
    this.send(plan);
  }

  protected confirmApply(): void {
    const asked = this.confirmingState();
    if (asked !== null && asked === this.plan() && !this.applying()) {
      this.send(asked);
    }
  }

  protected backFromConfirmation(): void {
    this.confirmingState.set(null);
  }

  /** T7 for the plan that is on screen, with the choice that plan was made for. */
  private send(plan: ApplyPreviewResponse): void {
    const workspace = this.session.workspace();
    const params = this.previewStore.previewParams();
    if (workspace === null || params === null || params.templateId === null) {
      return;
    }
    this.outdatedState.set(false);
    this.applyingState.set(true);
    this.api
      .apply(workspace.id, params.templateId, toConfirmedRequest(params, plan))
      .pipe(finalize(() => this.applyingState.set(false)))
      .subscribe({
        next: ({ application }) => {
          this.changes.eventsChanged();
          this.changes.templatesChanged();
          this.toast.show(applyResultText(application));
          this.ref.close(application);
          void this.router.navigateByUrl(weekUrl({ weekStart: application.weekStart, day: null }));
        },
        error: (error: unknown) => this.applyFailed(error, params),
      });
  }

  private applyFailed(error: unknown, params: ApplyParams): void {
    this.confirmingState.set(null);
    const code = isApiError(error) ? error.code : null;
    if (code === 'APPLY_PLAN_OUTDATED' || code === 'TEMPLATE_APPLY_CONFLICT') {
      // The week moved under the plan: show the new one, and say why it changed.
      this.outdatedState.set(true);
      this.previewStore.refresh(params);
    } else if (code === 'TEMPLATE_NOT_FOUND') {
      // The new T6 answers the same, and the dialog shows it (AP-06).
      this.changes.templatesChanged();
      this.previewStore.refresh(params);
    } else {
      this.toast.error(error);
    }
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
