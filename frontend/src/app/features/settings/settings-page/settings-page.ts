import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { WorkspaceRole } from '@core/api/models/enums';
import type { IsoInstant } from '@core/api/models/common.models';
import { WorkspaceApi } from '@core/api/workspace-api';
import { SessionStore } from '@core/auth/session-store';
import { ToastService } from '@core/notify/toast-service';
import { ZoneClock } from '@core/time/zone-clock';
import { InviteCard } from '@features/onboarding';
import { WORKSPACE_NAME_MAX } from '@shared/domain';
import { applyServerErrors, controlErrorMessage, SERVER_ERROR } from '@shared/forms/server-errors';
import { notBlank } from '@shared/forms/validators';
import { dayMonthYear, parseInstant } from '@shared/time';
import { Avatar } from '@shared/ui/avatar/avatar';
import { Button } from '@shared/ui/button/button';
import { FormField, FormFieldControl } from '@shared/ui/form-field/form-field';

const ROLE_LABEL: Readonly<Record<WorkspaceRole, string>> = {
  OWNER: 'Создатель',
  MEMBER: 'Участник',
};

/**
 * `/settings` (SET-01): only what the backend can do. The profile is read-only (there is no
 * endpoint to change it); the workspace can be renamed (W3 `{name}`); its time zone is shown,
 * not changed (OQ-1); the members come with the workspace (W2/W3 carry them, so W4 is not
 * asked again); the invite card appears while the partner has not joined.
 */
@Component({
  selector: 'tp-settings-page',
  imports: [ReactiveFormsModule, Avatar, Button, FormField, FormFieldControl, InviteCard],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly api = inject(WorkspaceApi);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(ToastService);
  private readonly clock = inject(ZoneClock);

  protected readonly user = this.session.user;
  protected readonly workspace = this.session.workspace;
  protected readonly members = this.session.members;
  protected readonly partnerMissing = this.session.isPartnerMissing;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [
      this.session.workspace()?.name ?? '',
      [notBlank, Validators.maxLength(WORKSPACE_NAME_MAX)],
    ],
  });
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
  /** The name on the form differs from the saved one: there is something to save. */
  protected readonly changed = computed(() => {
    this.formEvent();
    return this.form.controls.name.value.trim() !== this.workspace()?.name;
  });

  /** «20 ноября 2026» of an instant, by the clock of the workspace zone (FD-33). */
  protected dateOf(instant: IsoInstant): string {
    return dayMonthYear(this.clock.nowIn(this.session.timeZone() ?? 'UTC', parseInstant(instant)));
  }

  protected roleOf(role: WorkspaceRole): string {
    return ROLE_LABEL[role];
  }

  protected rename(): void {
    this.submitted.set(true);
    const workspace = this.workspace();
    if (this.pending() || this.form.invalid || workspace === null || !this.changed()) {
      return;
    }
    this.pending.set(true);
    this.api.update(workspace.id, { name: this.form.controls.name.value.trim() }).subscribe({
      next: (updated) => {
        this.pending.set(false);
        // The header shows the name from the session.
        this.session.setWorkspace(updated);
        this.form.reset({ name: updated.name });
        this.submitted.set(false);
        this.toast.show('Название сохранено');
      },
      error: (error: unknown) => {
        this.pending.set(false);
        // VALIDATION_FAILED: `name` → the field, the rest → under the form.
        if (!applyServerErrors(this.form, error)) {
          this.toast.error(error);
        }
      },
    });
  }
}
