// Keeps the workspace in the session current (WS-07). Partner joins and a lost workspace
// reach this tab only through W2: there is no push from the backend.
import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  type EnvironmentProviders,
  inject,
  Injectable,
  provideEnvironmentInitializer,
} from '@angular/core';
import { Router } from '@angular/router';
import type { WorkspaceResponse } from '../api/models/workspace.models';
import { ToastService } from '../notify/toast-service';
import { CLOCK } from '../time/zone-clock';
import { AuthService } from './auth-service';
import { SessionStore } from './session-store';

/** A wake-up re-reads the workspace at most this often. */
export const WORKSPACE_REFRESH_MIN_INTERVAL_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class WorkspaceRefresh {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly clock = inject(CLOCK);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private lastRun = Number.NEGATIVE_INFINITY;

  /**
   * While the partner has not joined, the tab coming back (`visibilitychange` to visible,
   * window `focus`) re-reads the workspace — at most once per 10 s: switching tabs fires
   * both events. Called once at start-up by {@link provideWorkspaceRefresh}.
   */
  listen(): void {
    const wake = () => this.refreshIfPartnerMissing();
    const view = this.document.defaultView;
    this.document.addEventListener('visibilitychange', wake);
    view?.addEventListener('focus', wake);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', wake);
      view?.removeEventListener('focus', wake);
    });
  }

  /**
   * The common `404 WORKSPACE_NOT_FOUND` handling for stores (decisions §9): re-read the
   * workspace; if there is none any more → onboarding. A failed re-read → a toast.
   */
  workspaceNotFound(): void {
    this.auth.reloadWorkspace().subscribe({
      next: (workspace) => this.leaveIfGone(workspace),
      error: (error: unknown) => this.toast.error(error),
    });
  }

  private refreshIfPartnerMissing(): void {
    const now = this.clock();
    if (
      !this.session.isPartnerMissing() ||
      this.document.visibilityState !== 'visible' ||
      now - this.lastRun < WORKSPACE_REFRESH_MIN_INTERVAL_MS
    ) {
      return;
    }
    this.lastRun = now;
    this.auth.reloadWorkspace().subscribe({
      next: (workspace) => this.leaveIfGone(workspace),
      // A background check stays silent: the next wake-up tries again. An expired session
      // has already been handled by the interceptor (toast and /login).
      error: () => undefined,
    });
  }

  private leaveIfGone(workspace: WorkspaceResponse | null): void {
    if (workspace === null) {
      void this.router.navigateByUrl('/onboarding');
    }
  }
}

/** Starts {@link WorkspaceRefresh} with the app. */
export function provideWorkspaceRefresh(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => inject(WorkspaceRefresh).listen());
}
