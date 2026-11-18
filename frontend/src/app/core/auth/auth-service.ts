// Session scenarios (decisions §5): restore at start-up, login, register, logout, workspace reload.
// Pages call these instead of AuthApi, so SessionStore is always filled the same way.
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, type Observable, of, switchMap, tap } from 'rxjs';
import { AuthApi } from '../api/auth-api';
import type { AuthResponse, LoginRequest, RegisterRequest } from '../api/models/auth.models';
import { isApiError } from '../error/api-error';
import { ToastService } from '../notify/toast-service';
import { SessionStore } from './session-store';
import { TokenRefresher } from './token-refresher';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly session = inject(SessionStore);
  private readonly refresher = inject(TokenRefresher);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /**
   * Start-up (FD-39): A3 by the cookie → A6 → `authenticated` with the workspace.
   * Never fails, so the app always starts: a refused refresh (401, no or old cookie) →
   * `anonymous` silently; any other error (network, 5xx) → `anonymous` and a toast.
   */
  restore(): Observable<void> {
    return this.refresher.refresh().pipe(
      switchMap(() => this.reloadWorkspace()),
      catchError((error: unknown) => {
        this.session.clear();
        if (!(isApiError(error) && error.status === 401)) {
          this.toast.error(error);
        }
        return of(undefined);
      }),
    );
  }

  /** A2 → session → A6. Errors go to the form (`applyServerErrors`). */
  login(body: LoginRequest): Observable<void> {
    return this.signIn(this.api.login(body));
  }

  /** A1 → session → A6. Errors go to the form (`applyServerErrors`). */
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
   * Reads the current workspace into the session (`null` → onboarding). For now through
   * A6, which returns it; WS-07 moves it to W2 with the `WORKSPACE_NOT_FOUND` handling.
   */
  reloadWorkspace(): Observable<void> {
    return this.api.me().pipe(
      tap((me) => this.session.setWorkspace(me.workspace)),
      map(() => undefined),
    );
  }

  private signIn(request: Observable<AuthResponse>): Observable<void> {
    return request.pipe(
      tap((response) => this.session.setAuth(response)),
      switchMap(() => this.reloadWorkspace()),
    );
  }
}
