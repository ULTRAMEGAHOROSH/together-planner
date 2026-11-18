import { Component, computed, inject, InjectionToken, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { WorkspaceApi } from '@core/api/workspace-api';
import { AuthService } from '@core/auth/auth-service';
import { SessionStore } from '@core/auth/session-store';
import { isApiError } from '@core/error/api-error';
import { ToastService } from '@core/notify/toast-service';
import { WORKSPACE_NAME_MAX } from '@shared/domain';
import { applyServerErrors, controlErrorMessage, SERVER_ERROR } from '@shared/forms/server-errors';
import { notBlank } from '@shared/forms/validators';
import { Button } from '@shared/ui/button/button';
import { FormField, FormFieldControl } from '@shared/ui/form-field/form-field';

/** Used when the browser's zone is unknown or the backend refuses it (FD-34). */
export const FALLBACK_TIME_ZONE = 'Asia/Almaty';

/** IANA zone of the browser (FD-34); an empty value falls back to Asia/Almaty. */
export const BROWSER_TIME_ZONE = new InjectionToken<string>('BROWSER_TIME_ZONE', {
  providedIn: 'root',
  factory: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
});

/**
 * «Создать пространство» (prototype): name (default «Мы») and the browser's zone, shown
 * only. W1 → `SessionStore.setWorkspace` → `created`, the page shows the invite.
 */
@Component({
  selector: 'tp-create-workspace-form',
  imports: [ReactiveFormsModule, Button, FormField, FormFieldControl],
  templateUrl: './create-workspace-form.html',
  styleUrl: './create-workspace-form.scss',
})
export class CreateWorkspaceForm {
  /** The workspace is in the session. */
  readonly created = output<void>();

  private readonly api = inject(WorkspaceApi);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['Мы', [notBlank, Validators.maxLength(WORKSPACE_NAME_MAX)]],
  });
  protected readonly timeZone = signal(inject(BROWSER_TIME_ZONE) || FALLBACK_TIME_ZONE);
  /** The backend refused the browser's zone, the fallback is used instead. */
  protected readonly zoneReplaced = signal(false);
  protected readonly pending = signal(false);
  private readonly submitted = signal(false);
  private readonly formEvent = toSignal(this.form.events);

  protected readonly errors = computed(() => {
    this.formEvent();
    const name = this.form.controls.name;
    return {
      name: name.touched || this.submitted() ? controlErrorMessage(name) : null,
      form: this.form.hasError(SERVER_ERROR) ? controlErrorMessage(this.form) : null,
    };
  });

  protected submit(): void {
    this.submitted.set(true);
    if (this.pending() || this.form.invalid) {
      return;
    }
    this.pending.set(true);
    this.api
      .create({ name: this.form.controls.name.value.trim(), timeZone: this.timeZone() })
      .subscribe({
        next: (workspace) => {
          this.pending.set(false);
          this.session.setWorkspace(workspace);
          this.created.emit();
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.handleError(error);
        },
      });
  }

  private handleError(error: unknown): void {
    if (isApiError(error) && error.code === 'INVALID_TIME_ZONE') {
      // Shown before the next try: the user decides with the zone in front of them.
      this.timeZone.set(FALLBACK_TIME_ZONE);
      this.zoneReplaced.set(true);
      return;
    }
    if (isApiError(error) && error.code === 'ALREADY_IN_WORKSPACE') {
      // Created or joined in another tab: there is nothing to create here.
      this.auth.reloadWorkspace().subscribe({
        next: () => void this.router.navigateByUrl('/week'),
        error: (reloadError: unknown) => this.toast.error(reloadError),
      });
      return;
    }
    // VALIDATION_FAILED: `name` → the field; `timeZone` (not a control) → under the form.
    if (!applyServerErrors(this.form, error)) {
      this.toast.error(error);
    }
  }
}
