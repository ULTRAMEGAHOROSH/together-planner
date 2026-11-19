import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type AbstractControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth-service';
import { safeReturnUrl } from '@core/auth/guards';
import { ToastService } from '@core/notify/toast-service';
import type { EventCategory } from '@core/api/models/enums';
import { CATEGORY_PALETTE } from '@shared/domain';
import { applyServerErrors, controlErrorMessage, SERVER_ERROR } from '@shared/forms/server-errors';
import { Button } from '@shared/ui/button/button';
import { FormField, FormFieldControl } from '@shared/ui/form-field/form-field';
import {
  type SegmentOption,
  SegmentedControl,
} from '@shared/ui/segmented-control/segmented-control';
import {
  AUTH_SERVER_ERRORS,
  type AuthMode,
  createAuthForm,
  setAuthMode,
  toLoginRequest,
  toRegisterRequest,
} from '../auth-form';

const TABS: readonly SegmentOption<AuthMode>[] = [
  { value: 'login', label: 'Вход' },
  { value: 'register', label: 'Регистрация' },
];

type Block = { height: number; category: EventCategory } | { height: number; free: true };

/** Decorative "two schedules side by side" from the prototype: [left column, right column]. */
const PREVIEW: readonly (readonly Block[])[] = [
  [
    { height: 26, category: 'SLEEP' },
    { height: 16, category: 'COMMUTE' },
    { height: 54, category: 'WORK' },
    { height: 18, category: 'FOOD' },
    { height: 40, category: 'WORK' },
    { height: 24, category: 'SPORT' },
    { height: 34, category: 'TOGETHER' },
  ],
  [
    { height: 20, category: 'SLEEP' },
    { height: 18, category: 'FOOD' },
    { height: 22, category: 'COMMUTE' },
    { height: 60, category: 'WORK' },
    { height: 30, free: true },
    { height: 28, category: 'REST' },
    { height: 34, category: 'TOGETHER' },
  ],
];

/**
 * «Вход / Регистрация» (prototype screen). The tab is the path: `/login` or `/register`
 * (route `data.mode`); `?returnUrl=` is where to go after success, otherwise `/week` —
 * the guards send a user without a workspace on to onboarding.
 */
@Component({
  selector: 'tp-auth-page',
  imports: [ReactiveFormsModule, Button, FormField, FormFieldControl, SegmentedControl],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  readonly mode = input<AuthMode>('login');
  readonly returnUrl = input<string>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly tabs = TABS;
  protected readonly preview = PREVIEW;
  protected readonly hours = ['07', '10', '13', '16', '19', '22'];
  protected readonly form = createAuthForm(inject(NonNullableFormBuilder), 'login');
  protected readonly pending = signal(false);
  private readonly submitted = signal(false);
  // Form state is not a signal: re-read it on every form event (value, status, touched).
  private readonly formEvent = toSignal(this.form.events);

  protected readonly isRegister = computed(() => this.mode() === 'register');
  /** Came from an invite link (WS-06): after sign-in the user goes back to `/join?code=`. */
  protected readonly invited = computed(() =>
    /^\/join(\?|$)/.test(safeReturnUrl(this.returnUrl()) ?? ''),
  );
  /** Error texts, shown after the first submit or after leaving the field (FD-83). */
  protected readonly errors = computed(() => {
    this.formEvent();
    const { displayName, email, password } = this.form.controls;
    const show = (control: AbstractControl) =>
      control.touched || this.submitted() ? controlErrorMessage(control) : null;
    return {
      displayName: show(displayName),
      email: show(email),
      password: show(password),
      form: this.form.hasError(SERVER_ERROR) ? controlErrorMessage(this.form) : null,
    };
  });

  constructor() {
    effect(() => setAuthMode(this.form, this.mode()));
  }

  protected blockColor(block: Block): string | null {
    return 'free' in block ? null : CATEGORY_PALETTE[block.category].bg;
  }

  protected switchTo(mode: AuthMode): void {
    void this.router.navigate(['/', mode], { queryParamsHandling: 'preserve' });
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.pending() || this.form.invalid) {
      return;
    }
    this.pending.set(true);
    const request = this.isRegister()
      ? this.auth.register(toRegisterRequest(this.form))
      : this.auth.login(toLoginRequest(this.form));
    request.subscribe({
      complete: () => {
        this.pending.set(false);
        void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? '/week');
      },
      error: (error: unknown) => {
        this.pending.set(false);
        if (!applyServerErrors(this.form, error, AUTH_SERVER_ERRORS)) {
          this.toast.error(error);
        }
      },
    });
  }
}
