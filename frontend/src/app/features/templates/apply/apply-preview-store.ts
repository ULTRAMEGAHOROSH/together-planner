// The preview of an application (TPL-06, FD-84): asks T6 for the plan of the backend and
// shows what comes back. It decides nothing itself: no «is the day busy», «is it a duplicate»,
// «what to delete» lives on the client.
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, defer, map, of, Subject, switchMap, throwError } from 'rxjs';
import type { ApplyPreviewResponse } from '@core/api/models/template.models';
import { TemplatesApi } from '@core/api/templates-api';
import { SessionStore } from '@core/auth/session-store';
import { WorkspaceRefresh } from '@core/auth/workspace-refresh';
import { ApiError, isApiError } from '@core/error/api-error';
import { type ApplyParams, toApplyRequest } from './apply-params';

/** Every change of the choice waits this long for the next one before it asks. */
export const PREVIEW_DEBOUNCE_MS = 150;

/** `idle` — no template to ask about. `loading` keeps the previous plan only for display. */
export type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

@Injectable()
export class ApplyPreviewStore {
  private readonly api = inject(TemplatesApi);
  private readonly session = inject(SessionStore);
  private readonly workspaceRefresh = inject(WorkspaceRefresh);
  private readonly requests = new Subject<ApplyParams>();

  private readonly statusState = signal<PreviewStatus>('idle');
  private readonly previewState = signal<ApplyPreviewResponse | null>(null);
  private readonly errorState = signal<ApiError | null>(null);

  readonly status = this.statusState.asReadonly();
  /**
   * The last plan that arrived. It is the plan **for the choice on screen** only while
   * `status` is `ready`; after a change of the choice it is the old plan until the new one
   * comes (or an error), so nothing may be applied from it then (TPL-07).
   */
  readonly preview = this.previewState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor() {
    this.requests
      .pipe(
        debounceTime(PREVIEW_DEBOUNCE_MS),
        // A newer choice cancels the older request: an answer that comes late is dropped.
        switchMap((params) => this.fetch(params)),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((result) => this.apply(result));
  }

  /** The choice changed (or `templateId` is not known yet): ask for the plan again. */
  request(params: ApplyParams): void {
    if (params.templateId === null) {
      this.statusState.set('idle');
      this.previewState.set(null);
      this.errorState.set(null);
      return;
    }
    this.statusState.set('loading');
    this.requests.next(params);
  }

  /** Asks again for the same choice at once (after a plan that turned out to be old). */
  refresh(params: ApplyParams): void {
    this.request(params);
  }

  private fetch(params: ApplyParams) {
    return defer(() => {
      const workspace = this.session.workspace();
      // No workspace is the same as «not found»: it takes the common route below.
      return workspace === null || params.templateId === null
        ? throwError(() => new ApiError('WORKSPACE_NOT_FOUND', { status: 404 }))
        : this.api.preview(workspace.id, params.templateId, toApplyRequest(params));
    }).pipe(
      map((preview) => ({ preview }) as const),
      catchError((error: unknown) =>
        of({ error: isApiError(error) ? error : new ApiError('UNKNOWN') } as const),
      ),
    );
  }

  private apply(result: { preview: ApplyPreviewResponse } | { error: ApiError }): void {
    if ('preview' in result) {
      this.previewState.set(result.preview);
      this.errorState.set(null);
      this.statusState.set('ready');
      return;
    }
    // After an error nothing stays that could be mistaken for the plan.
    this.previewState.set(null);
    this.errorState.set(result.error);
    this.statusState.set('error');
    if (result.error.code === 'WORKSPACE_NOT_FOUND') {
      this.workspaceRefresh.workspaceNotFound();
    }
  }
}
