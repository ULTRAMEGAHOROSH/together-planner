import { Component, computed, inject, input, type OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WorkspaceApi } from '@core/api/workspace-api';
import { SessionStore } from '@core/auth/session-store';
import { ToastService } from '@core/notify/toast-service';
import {
  applyServerErrors,
  controlErrorMessage,
  SERVER_ERROR,
  type ServerErrorMap,
} from '@shared/forms/server-errors';
import { notBlank } from '@shared/forms/validators';
import { Button } from '@shared/ui/button/button';
import { FormField, FormFieldControl } from '@shared/ui/form-field/form-field';

/** W6 errors about the code, shown at the field (spec §9.6). */
export const JOIN_SERVER_ERRORS: ServerErrorMap = {
  INVITE_NOT_FOUND: 'code',
  INVITE_EXPIRED: 'code',
  INVITE_ALREADY_USED: 'code',
  WORKSPACE_FULL: 'code',
  ALREADY_IN_WORKSPACE: 'code',
};

/**
 * «У меня есть код» (prototype): the partner's invite code → W6 → the workspace in the
 * session → `/week`. Case, the dash and spaces do not matter: the backend normalizes the code.
 */
@Component({
  selector: 'tp-join-workspace-form',
  imports: [ReactiveFormsModule, Button, FormField, FormFieldControl],
  templateUrl: './join-workspace-form.html',
  styleUrl: './join-workspace-form.scss',
})
export class JoinWorkspaceForm implements OnInit {
  /** Fills the field, e.g. from the invite link (WS-06); never sent without a click. */
  readonly code = input('');

  private readonly api = inject(WorkspaceApi);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    code: ['', [notBlank]],
  });
  protected readonly pending = signal(false);
  private readonly submitted = signal(false);
  private readonly formEvent = toSignal(this.form.events);

  protected readonly errors = computed(() => {
    this.formEvent();
    const code = this.form.controls.code;
    return {
      code: code.touched || this.submitted() ? controlErrorMessage(code) : null,
      form: this.form.hasError(SERVER_ERROR) ? controlErrorMessage(this.form) : null,
    };
  });

  ngOnInit(): void {
    this.form.controls.code.setValue(this.code());
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.pending() || this.form.invalid) {
      return;
    }
    this.pending.set(true);
    this.api.join({ code: this.form.controls.code.value.trim() }).subscribe({
      next: (workspace) => {
        this.pending.set(false);
        this.session.setWorkspace(workspace);
        void this.router.navigateByUrl('/week');
      },
      error: (error: unknown) => {
        this.pending.set(false);
        if (!applyServerErrors(this.form, error, JOIN_SERVER_ERRORS)) {
          this.toast.error(error);
        }
      },
    });
  }
}
