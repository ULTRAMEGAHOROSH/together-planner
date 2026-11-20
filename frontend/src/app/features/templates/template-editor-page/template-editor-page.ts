import { Location } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  defer,
  finalize,
  map,
  type Observable,
  switchMap,
  type Subscription,
  throwError,
} from 'rxjs';
import { DAYS_OF_WEEK, type DayOfWeek } from '@core/api/models/enums';
import type { TemplateResponse } from '@core/api/models/template.models';
import { TemplatesApi } from '@core/api/templates-api';
import { SessionStore } from '@core/auth/session-store';
import { DataChanges } from '@core/changes/data-changes';
import { ApiError, isApiError } from '@core/error/api-error';
import { ERROR_MESSAGES, messageFor } from '@core/error/error-messages';
import type { HasUnsavedChanges } from '@core/navigation/unsaved-changes-guard';
import { ToastService } from '@core/notify/toast-service';
import { applyServerErrors, controlErrorMessage } from '@shared/forms/server-errors';
import { capitalize, WEEKDAYS_LONG } from '@shared/time';
import { Button } from '@shared/ui/button/button';
import { openConfirm } from '@shared/ui/confirm-dialog/confirm-dialog';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { FormField, FormFieldControl } from '@shared/ui/form-field/form-field';
import { Icon } from '@shared/ui/icon/icon';
import { Spinner } from '@shared/ui/spinner/spinner';
import { ApplyTemplateEntry } from '../apply/apply-entry';
import { TemplateConflictDialog } from '../template-conflict-dialog/template-conflict-dialog';
import { TemplateEventRowComponent } from '../template-event-row/template-event-row';
import {
  addTemplateEvent,
  createTemplateForm,
  fromTemplateResponse,
  removeTemplateEvent,
  TEMPLATE_SERVER_ERRORS,
  type TemplateEventRow,
  type TemplateForm,
  type TemplateFormValue,
  templateFormError,
  toTemplateRequest,
} from '../template-form';

export const TEMPLATE_SAVED_TEXT = 'Шаблон сохранён. Уже заполненные недели не изменились';

/** A day of the week with the rows that fall on it, by start time. */
export interface DayGroup {
  readonly day: DayOfWeek;
  readonly label: string;
  readonly rows: readonly TemplateEventRow[];
}

/** Rows without a valid start go last. */
function byStart(a: TemplateEventRow, b: TemplateEventRow): number {
  const left = a.controls.startTime.value || '99:99';
  const right = b.controls.startTime.value || '99:99';
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * `/templates/new` and `/templates/:templateId` (TPL-04): the template form, its events
 * grouped by day. The form logic is in `template-form.ts`. After a save the form is rebuilt
 * from the answer, so new rows get their ids and the next save is an update (no duplicates).
 * Rows are sorted into their days when they are added, removed or settled (`commit`), not
 * on every keystroke, so a row does not jump away while its time is being typed.
 */
@Component({
  selector: 'tp-template-editor-page',
  imports: [
    Button,
    ErrorState,
    FormField,
    FormFieldControl,
    Icon,
    ReactiveFormsModule,
    Spinner,
    TemplateEventRowComponent,
  ],
  templateUrl: './template-editor-page.html',
  styleUrl: './template-editor-page.scss',
  host: { '(window:beforeunload)': 'warnBeforeUnload($event)' },
})
export class TemplateEditorPage implements OnInit, HasUnsavedChanges {
  /** The `:templateId` of the address (component input binding); none — a new template. */
  readonly templateId = input<string>();

  private readonly api = inject(TemplatesApi);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly changes = inject(DataChanges);
  private readonly applier = inject(ApplyTemplateEntry);

  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly loadError = signal<ApiError | null>(null);
  protected readonly form = signal<TemplateForm>(createTemplateForm());
  /** The saved template (its id and version); `null` until the first save of a new one. */
  protected readonly template = signal<TemplateResponse | null>(null);
  protected readonly days = signal<readonly DayGroup[]>([]);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly dirty = signal(false);
  private leaving = false;
  private valueSubscription: Subscription | undefined;

  protected readonly members = this.session.members;
  protected readonly heading = computed(() => this.template()?.name ?? 'Новый шаблон');
  protected readonly loadErrorText = computed(() => messageFor(this.loadError()));

  /** Reactive forms are not signals: every event of the current form. */
  private readonly formEvents = toSignal(
    toObservable(this.form).pipe(switchMap((form) => form.events)),
  );
  protected readonly nameError = computed(() => this.fieldError('name'));
  protected readonly descriptionError = computed(() => this.fieldError('description'));
  protected readonly formError = computed(() => {
    this.formEvents();
    return templateFormError(this.form());
  });
  protected readonly eventCount = computed(() => {
    this.formEvents();
    return this.form().controls.events.length;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.valueSubscription?.unsubscribe());
  }

  ngOnInit(): void {
    const id = this.templateId();
    if (id === undefined) {
      this.install(null);
      this.status.set('ready');
    } else {
      this.load(id);
    }
  }

  /** «Повторить» after a failed load. */
  protected retry(): void {
    const id = this.templateId();
    if (id !== undefined) {
      this.load(id);
    }
  }

  /** «Применить к неделе»: the saved template, next week. */
  protected applyToWeek(): void {
    const id = this.template()?.id;
    if (id !== undefined) {
      this.applier.openForTemplate(id);
    }
  }

  protected back(): void {
    void this.router.navigate(['/templates']);
  }

  protected add(day: DayOfWeek): void {
    addTemplateEvent(this.form(), {
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '10:00',
      participants: {
        seat1: this.session.me()?.seat !== 2,
        seat2: this.session.me()?.seat === 2,
      },
    });
    this.regroup();
  }

  protected duplicate(row: TemplateEventRow): void {
    addTemplateEvent(this.form(), row.getRawValue());
    this.regroup();
  }

  protected remove(row: TemplateEventRow): void {
    const form = this.form();
    removeTemplateEvent(form, form.controls.events.controls.indexOf(row));
    this.regroup();
  }

  protected regroup(): void {
    const rows = this.form().controls.events.controls;
    this.days.set(
      DAYS_OF_WEEK.map((day, index) => ({
        day,
        label: capitalize(WEEKDAYS_LONG[index]),
        rows: rows.filter((row) => row.controls.dayOfWeek.value === day).sort(byStart),
      })),
    );
  }

  protected save(): void {
    this.submitted.set(true);
    const workspace = this.session.workspace();
    const form = this.form();
    if (this.saving() || workspace === null || form.invalid) {
      return;
    }
    const current = this.template();
    const request = toTemplateRequest(form, this.members(), current?.version);
    this.saving.set(true);
    const call =
      current === null
        ? this.api.create(workspace.id, request)
        : this.api.update(workspace.id, current.id, { ...request, version: current.version });
    call.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => this.saved(saved, current === null),
      error: (error: unknown) => this.failed(error),
    });
  }

  /** The route guard: leaving with unsaved edits asks first. */
  confirmLeave(): boolean | Observable<boolean> {
    if (!this.dirty() || this.leaving) {
      return true;
    }
    return openConfirm(this.dialogs, {
      title: 'Выйти без сохранения?',
      text: 'Изменения в шаблоне не сохранены и пропадут.',
      confirmLabel: 'Выйти',
      cancelLabel: 'Остаться',
    }).pipe(map((confirmed) => confirmed === true));
  }

  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() && !this.leaving) {
      event.preventDefault();
    }
  }

  private fieldError(field: 'name' | 'description'): string | null {
    this.formEvents();
    const control = this.form().controls[field];
    return this.submitted() || control.touched ? controlErrorMessage(control) : null;
  }

  /** Puts `template` (or an empty form) into the page; nothing is changed yet. */
  private install(template: TemplateResponse | null): void {
    const value: Partial<TemplateFormValue> =
      template === null ? {} : fromTemplateResponse(template, this.members());
    const form = createTemplateForm(value);
    this.valueSubscription?.unsubscribe();
    // Every edit, also adding and removing rows, comes through here.
    this.valueSubscription = form.valueChanges.subscribe(() => this.dirty.set(true));
    this.template.set(template);
    this.form.set(form);
    this.dirty.set(false);
    this.submitted.set(false);
    this.regroup();
  }

  private load(id: string): void {
    this.status.set('loading');
    this.fetch(id).subscribe({
      next: (template) => {
        this.install(template);
        this.status.set('ready');
      },
      error: (error: unknown) => {
        if (this.gone(error)) {
          return;
        }
        this.loadError.set(isApiError(error) ? error : new ApiError('UNKNOWN'));
        this.status.set('error');
      },
    });
  }

  private fetch(id: string): Observable<TemplateResponse> {
    return defer(() => {
      const workspace = this.session.workspace();
      return workspace === null
        ? throwError(() => new ApiError('WORKSPACE_NOT_FOUND', { status: 404 }))
        : this.api.get(workspace.id, id);
    });
  }

  private saved(saved: TemplateResponse, created: boolean): void {
    // The form is rebuilt from the answer: new rows get ids, so the next save is T4.
    this.install(saved);
    if (created) {
      // The page stays: only the address changes (a router navigation would rebuild it).
      this.location.replaceState(`/templates/${saved.id}`);
    }
    this.changes.templatesChanged();
    this.toast.show(TEMPLATE_SAVED_TEXT);
  }

  private failed(error: unknown): void {
    if (applyServerErrors(this.form(), error, TEMPLATE_SERVER_ERRORS)) {
      return;
    }
    if (this.gone(error)) {
      return;
    }
    if (isApiError(error) && error.code === 'VERSION_CONFLICT') {
      this.dialogs
        .open<true>(TemplateConflictDialog, undefined, { size: 'sm' })
        .subscribe((load) => {
          if (load) {
            this.reload();
          }
        });
      return;
    }
    this.toast.error(error);
  }

  /** «Загрузить актуальную»: T3, and the form is filled again (it saves with the new version). */
  private reload(): void {
    const id = this.template()?.id;
    if (id === undefined) {
      return;
    }
    this.fetch(id).subscribe({
      next: (fresh) => this.install(fresh),
      error: (error: unknown) => {
        if (!this.gone(error)) {
          this.toast.error(error);
        }
      },
    });
  }

  /** The template is gone (404): say so and go to the list; nothing is left to protect. */
  private gone(error: unknown): boolean {
    if (!isApiError(error) || error.code !== 'TEMPLATE_NOT_FOUND') {
      return false;
    }
    this.leaving = true;
    this.changes.templatesChanged();
    this.toast.show(ERROR_MESSAGES.TEMPLATE_NOT_FOUND);
    void this.router.navigate(['/templates']);
    return true;
  }
}
