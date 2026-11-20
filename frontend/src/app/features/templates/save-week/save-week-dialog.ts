import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import type { IsoDate } from '@core/api/models/common.models';
import type { TemplateResponse } from '@core/api/models/template.models';
import type { WeekResponse } from '@core/api/models/week.models';
import { TemplatesApi } from '@core/api/templates-api';
import { WeekApi } from '@core/api/week-api';
import { SessionStore } from '@core/auth/session-store';
import { DataChanges } from '@core/changes/data-changes';
import { type ApiError, isApiError } from '@core/error/api-error';
import { ERROR_MESSAGES, messageFor } from '@core/error/error-messages';
import { ToastService } from '@core/notify/toast-service';
import { ZoneClock } from '@core/time/zone-clock';
import { DIALOG_DATA } from '@angular/cdk/dialog';
import { TEMPLATE_EVENTS_MAX, TEMPLATE_NAME_MAX } from '@shared/domain/event-constraints';
import { plural, relWeek, weekLabel, weekShort, weekStartOf } from '@shared/time';
import { Button } from '@shared/ui/button/button';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { DialogShell } from '@shared/ui/dialog/dialog-shell';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { FormField, FormFieldControl } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { Spinner } from '@shared/ui/spinner/spinner';
import { mondayOf, shiftWeek, weeksBetween } from '../apply/apply-params';
import { defaultTemplateName, type SkipReason, weekToTemplate } from '../week-to-template';

export interface SaveWeekDialogData {
  /** Any date of the week to start with: the dialog works with its Monday. */
  weekStart: IsoDate;
}

const SKIP_TEXT: Record<SkipReason, string> = {
  startedEarlier: 'началось на прошлой неделе',
  noParticipants: 'никого из участников пространства',
  noLength: 'нулевая длительность',
};

export const SAVED_TEXT = (name: string, count: number): string =>
  `Шаблон «${name}» создан из ${count} ${plural(count, 'события', 'событий', 'событий')}`;

/**
 * «Сохранить неделю как шаблон» (TPL-12, OQ-3): the week from S1 becomes a T2 body by
 * `weekToTemplate`. The dialog shows what goes in and, by name, what does not; nothing is
 * saved until «Сохранить», and it cannot be pressed while the week loads or is over the limit.
 */
@Component({
  selector: 'tp-save-week-dialog',
  imports: [Button, DialogShell, ErrorState, FormField, FormFieldControl, Icon, Spinner],
  templateUrl: './save-week-dialog.html',
  styleUrl: './save-week-dialog.scss',
})
export class SaveWeekDialog implements OnInit {
  protected readonly data = inject<SaveWeekDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<TemplateResponse | undefined>>(DialogRef);
  private readonly weekApi = inject(WeekApi);
  private readonly templatesApi = inject(TemplatesApi);
  private readonly session = inject(SessionStore);
  private readonly clock = inject(ZoneClock);
  private readonly toast = inject(ToastService);
  private readonly changes = inject(DataChanges);

  private readonly weekStartState = signal<IsoDate>(mondayOf(this.data.weekStart));
  private readonly weekState = signal<WeekResponse | null>(null);
  private readonly statusState = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly loadErrorState = signal<ApiError | null>(null);
  private readonly typedName = signal<string | null>(null);
  private readonly savingState = signal(false);
  private readonly serverNameError = signal<string | null>(null);
  private request: Subscription | undefined;

  protected readonly nameMax = TEMPLATE_NAME_MAX;
  protected readonly eventsMax = TEMPLATE_EVENTS_MAX;
  readonly weekStart = this.weekStartState.asReadonly();
  protected readonly status = this.statusState.asReadonly();
  protected readonly saving = this.savingState.asReadonly();
  protected readonly loadErrorText = computed(() => messageFor(this.loadErrorState()));

  /** What the user typed, else the name of the week. */
  readonly name = computed(() => this.typedName() ?? defaultTemplateName(this.weekStart()));
  protected readonly nameError = computed(() => {
    const name = this.name().trim();
    if (this.serverNameError() !== null) return this.serverNameError();
    if (name === '') return 'Введите название шаблона.';
    return null;
  });

  /** The rule of OQ-3 on the week that came; `null` until it comes. */
  readonly draft = computed(() => {
    const week = this.weekState();
    return week === null
      ? null
      : weekToTemplate(week.weekStart, week.events, this.session.members(), this.name().trim());
  });
  protected readonly skipped = computed(() =>
    (this.draft()?.skipped ?? []).map((s) => `«${s.title}» — ${SKIP_TEXT[s.reason]}`),
  );
  protected readonly clamped = computed(() =>
    (this.draft()?.clamped ?? []).map((c) => `«${c.title}»`),
  );
  protected readonly summary = computed(() => {
    const draft = this.draft();
    if (draft === null || draft.tooMany) return null;
    return draft.count === 0
      ? 'В этой неделе нет событий, которые можно сохранить.'
      : `В шаблон попадёт ${draft.count} ${plural(draft.count, 'событие', 'события', 'событий')}.`;
  });
  readonly canSave = computed(() => {
    const draft = this.draft();
    return (
      this.statusState() === 'ready' &&
      draft !== null &&
      draft.request !== null &&
      draft.count > 0 &&
      this.nameError() === null &&
      this.name().trim().length <= TEMPLATE_NAME_MAX &&
      !this.savingState()
    );
  });

  protected readonly weekText = computed(() => weekShort(this.weekStart()));
  protected readonly weekTitle = computed(() => weekLabel(this.weekStart()));
  protected readonly weekRelative = computed(() => {
    const zone = this.session.timeZone();
    if (zone === null) return '';
    const current = weekStartOf(this.clock.todayIn(zone, this.clock.minuteTick()));
    return relWeek(weeksBetween(current, this.weekStart()));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    this.load();
  }

  /** The week is asked again; a newer week cancels the older answer. */
  protected load(): void {
    const workspace = this.session.workspace();
    if (workspace === null) return;
    this.request?.unsubscribe();
    this.statusState.set('loading');
    this.weekState.set(null);
    this.request = this.weekApi.get(workspace.id, this.weekStart()).subscribe({
      next: (week) => {
        this.weekState.set(week);
        this.loadErrorState.set(null);
        this.statusState.set('ready');
      },
      error: (error: unknown) => {
        this.loadErrorState.set(isApiError(error) ? error : null);
        this.statusState.set('error');
      },
    });
  }

  protected shiftWeek(weeks: number): void {
    this.weekStartState.set(shiftWeek(this.weekStart(), weeks));
    this.load();
  }

  protected typeName(value: string): void {
    this.typedName.set(value);
    this.serverNameError.set(null);
  }

  protected save(): void {
    const workspace = this.session.workspace();
    const request = this.draft()?.request;
    if (!this.canSave() || workspace === null || !request) return;
    this.savingState.set(true);
    this.templatesApi.create(workspace.id, request).subscribe({
      next: (template) => {
        this.changes.templatesChanged();
        this.toast.show(SAVED_TEXT(template.name, template.events.length));
        this.ref.close(template);
      },
      error: (error: unknown) => {
        this.savingState.set(false);
        if (isApiError(error) && error.code === 'TEMPLATE_NAME_TAKEN') {
          this.serverNameError.set(ERROR_MESSAGES.TEMPLATE_NAME_TAKEN);
        } else {
          this.toast.error(error);
        }
      },
    });
  }
}

/** Opens {@link SaveWeekDialog}; closes with the created template, or nothing. */
export function openSaveWeek(dialogs: DialogService, data: SaveWeekDialogData) {
  return dialogs.open<TemplateResponse | undefined, SaveWeekDialogData>(SaveWeekDialog, data, {
    size: 'lg',
  });
}
