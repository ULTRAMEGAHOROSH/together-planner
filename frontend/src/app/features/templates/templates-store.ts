// The list of templates (TPL-02, FD-25…28): loads T1, keeps the old list while a new one
// loads, listens to `templatesChanged` and deletes (T5). Knows neither the DOM nor the router.
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, defer, finalize, map, of, Subject, switchMap, throwError } from 'rxjs';
import { TemplatesApi } from '@core/api/templates-api';
import type { Uuid } from '@core/api/models/common.models';
import type { TemplateResponse } from '@core/api/models/template.models';
import { SessionStore } from '@core/auth/session-store';
import { WorkspaceRefresh } from '@core/auth/workspace-refresh';
import { DataChanges } from '@core/changes/data-changes';
import { ApiError, isApiError } from '@core/error/api-error';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { ToastService } from '@core/notify/toast-service';

/** `idle` — not asked yet. `loading` may come with the previous list in `templates`. */
export type TemplatesStatus = 'idle' | 'loading' | 'ready' | 'error';

export const TEMPLATE_DELETED_TEXT =
  'Шаблон удалён. Созданные из него события остались на своих неделях';
export const TEMPLATE_CHANGED_TEXT = 'Партнёр изменил шаблон. Список обновлён — проверьте ещё раз.';

@Injectable()
export class TemplatesStore {
  private readonly api = inject(TemplatesApi);
  private readonly session = inject(SessionStore);
  private readonly workspaceRefresh = inject(WorkspaceRefresh);
  private readonly changes = inject(DataChanges);
  private readonly toast = inject(ToastService);
  private readonly requests = new Subject<void>();

  private readonly statusState = signal<TemplatesStatus>('idle');
  private readonly templatesState = signal<readonly TemplateResponse[]>([]);
  private readonly errorState = signal<ApiError | null>(null);
  private readonly deletingState = signal<Uuid | null>(null);

  readonly status = this.statusState.asReadonly();
  /** The last list that arrived; kept while the next one loads. */
  readonly templates = this.templatesState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** The template whose T5 is running; only one at a time. */
  readonly deletingId = this.deletingState.asReadonly();

  constructor() {
    this.requests
      .pipe(
        // A newer request cancels the older one: only the last answer reaches the state.
        switchMap(() => this.fetch()),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((result) => this.apply(result));
    this.changes.templates$
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.load());
  }

  /** Asks the server for the list (first load, «Повторить», after a change). */
  load(): void {
    this.statusState.set('loading');
    this.requests.next();
  }

  /**
   * T5 with the version the user saw. Success: everyone is told (`templatesChanged`) and a
   * toast explains that created events stay. 404 — already gone, 409 — changed by the
   * partner: the list is read again and the user is told. Other errors only a toast.
   */
  remove(template: TemplateResponse): void {
    const workspace = this.session.workspace();
    if (workspace === null || this.deletingState() !== null) {
      return;
    }
    this.deletingState.set(template.id);
    this.api
      .delete(workspace.id, template.id, template.version)
      .pipe(finalize(() => this.deletingState.set(null)))
      .subscribe({
        next: () => {
          this.changes.templatesChanged();
          this.toast.show(TEMPLATE_DELETED_TEXT);
        },
        error: (error: unknown) => {
          const code = isApiError(error) ? error.code : null;
          if (code === 'TEMPLATE_NOT_FOUND') {
            this.changes.templatesChanged();
            this.toast.show(ERROR_MESSAGES.TEMPLATE_NOT_FOUND);
          } else if (code === 'VERSION_CONFLICT') {
            this.changes.templatesChanged();
            this.toast.show(TEMPLATE_CHANGED_TEXT);
          } else {
            this.toast.error(error);
          }
        },
      });
  }

  private fetch() {
    return defer(() => {
      const workspace = this.session.workspace();
      // No workspace is the same as «not found»: it takes the common route below.
      return workspace === null
        ? throwError(() => new ApiError('WORKSPACE_NOT_FOUND', { status: 404 }))
        : this.api.list(workspace.id);
    }).pipe(
      map((templates) => ({ templates }) as const),
      catchError((error: unknown) =>
        of({ error: isApiError(error) ? error : new ApiError('UNKNOWN') } as const),
      ),
    );
  }

  private apply(result: { templates: TemplateResponse[] } | { error: ApiError }): void {
    if ('templates' in result) {
      this.templatesState.set(result.templates);
      this.errorState.set(null);
      this.statusState.set('ready');
      return;
    }
    this.errorState.set(result.error);
    this.statusState.set('error');
    if (result.error.code === 'WORKSPACE_NOT_FOUND') {
      this.workspaceRefresh.workspaceNotFound();
    }
  }
}
