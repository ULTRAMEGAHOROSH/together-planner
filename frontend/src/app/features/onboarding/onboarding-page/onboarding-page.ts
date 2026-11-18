import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '@core/auth/session-store';
import { Button } from '@shared/ui/button/button';

/** Left card: the create form, then the created workspace with its invite. */
export type OnboardingStep = 'create' | 'created';

/**
 * «Общее пространство» (prototype screen): one partner creates the workspace, the other
 * joins with a code. Both paths are on the screen at once, as in the prototype; the step
 * switches the left card after the workspace is created.
 */
@Component({
  selector: 'tp-onboarding-page',
  imports: [Button],
  templateUrl: './onboarding-page.html',
  styleUrl: './onboarding-page.scss',
})
export class OnboardingPage {
  private readonly router = inject(Router);

  protected readonly step = signal<OnboardingStep>('create');
  protected readonly workspace = inject(SessionStore).workspace;

  /** The create form (WS-03) calls it after W1 has put the workspace into the session. */
  showCreated(): void {
    this.step.set('created');
  }

  protected toSchedule(): void {
    void this.router.navigateByUrl('/week');
  }
}
