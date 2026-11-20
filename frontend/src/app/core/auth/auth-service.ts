// Session scenarios (decisions §5): restore at start-up, login, register, logout, workspace reload.
// Pages call these instead of AuthApi, so SessionStore is always filled the same way.
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, type Observable, of, switchMap, tap, throwError } from 'rxjs';
import { AuthApi } from '../api/auth-api';
import type { AuthResponse, LoginRequest, RegisterRequest } from '../api/models/auth.models';
import type { WorkspaceResponse } from '../api/models/workspace.models';
import { WorkspaceApi } from '../api/workspace-api';
import { isApiError } from '../error/api-error';
import { ToastService } from '../notify/toast-service';
import { SessionStore } from './session-store';
import { TokenRefresher } from './token-refresher';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly workspaces = inject(WorkspaceApi);
  private readonly session = inject(SessionStore);
  private readonly refresher = inject(TokenRefresher);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /**
   * Start-up (FD-39): A3 by the cookie → W2 → `authenticated` with the workspace.
   * Never fails, so the app always starts: a refused refresh (401, no or old cookie) →
   * `anonymous` silently; any other error (network, 5xx) → `anonymous` and a toast.
   */
  restore(): Observable<void> {
    return this.refresher.refresh().pipe(
      switchMap(() => this.reloadWorkspace()),
      map(() => undefined),
      catchError((error: unknown) => {
        this.session.clear();
        if (!(isApiError(error) && error.status === 401)) {
          this.toast.error(error);
        }
        return of(undefined);
      }),
    );
  }

  /** A2 → session → W2. Errors go to the form (`applyServerErrors`). */
  login(body: LoginRequest): Observable<void> {
    return this.signIn(this.api.login(body));
  }

  /** A1 → session → W2. Errors go to the form (`applyServerErrors`). */
  register(body: RegisterRequest): Observable<void> {
    return this.signIn(this.api.register(body));
  }

  /**
   * A4 (revokes the refresh cookie) → `SessionStore.clear()` → `/login` (decisions §5.3).
   * Never fails: if the server cannot be reached, the user is still signed out here.
   */
  logout(): Observable<void> {
    return this.api.logout().pipe(
      catchError(() => of(undefined)),
      map(() => {
        this.session.clear();
        void this.router.navigateByUrl('/login');
      }),
    );
  }

  /**
   * A5 (revokes every refresh token of the user, needs Bearer) → `SessionStore.clear()` →
   * `/login`. Unlike {@link logout} it can fail, and then the user stays signed in here: the
   * point is that the other devices are cut off, and a silent local sign-out would hide that
   * they are not. Access tokens already issued work for up to 15 minutes (spec A5).
   */
  logoutAll(): Observable<void> {
    return this.api.logoutAll().pipe(
      map(() => {
        this.session.clear();
        void this.router.navigateByUrl('/login');
      }),
    );
  }

  /**
   * W2 → the session (WS-07). `404 WORKSPACE_NOT_FOUND` means the user has no workspace:
   * `null` in the session (the guards send them to onboarding), not an error. Other errors
   * go to the caller, and the session keeps what it had.
   */
  reloadWorkspace(): Observable<WorkspaceResponse | null> {
    return this.workspaces.current().pipe(
      catchError((error: unknown) =>
        isApiError(error) && error.code === 'WORKSPACE_NOT_FOUND'
          ? of(null)
          : throwError(() => error),
      ),
      tap((workspace) => this.session.setWorkspace(workspace)),
    );
  }

  private signIn(request: Observable<AuthResponse>): Observable<void> {
    return request.pipe(
      tap((response) => this.session.setAuth(response)),
      switchMap(() => this.reloadWorkspace()),
      map(() => undefined),
    );
  }
}
