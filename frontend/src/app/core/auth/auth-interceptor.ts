// Headers and transparent token refresh (FD-37, FD-38, decisions §5.2). Runs before
// errorInterceptor in the chain, so the errors it sees are already ApiError.
import {
  HttpContext,
  HttpContextToken,
  type HttpEvent,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, type Observable, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../api/api-base-url';
import { ApiError, isApiError } from '../error/api-error';
import { ToastService } from '../notify/toast-service';
import { SessionStore } from './session-store';
import { TokenRefresher } from './token-refresher';

/** Set on the one repeat of a request after a refresh: its 401 does not refresh again. */
export const RETRIED = new HttpContextToken<boolean>(() => false);

/**
 * Endpoints that work by the refresh cookie or without a session. They get no Bearer:
 * an invalid one on a permitAll endpoint gives 401 (spec §10.3), and their 401
 * (`INVALID_CREDENTIALS`, `REFRESH_TOKEN_*`) is not a reason to refresh.
 */
const NO_BEARER = ['register', 'login', 'refresh', 'logout'].map((path) => `/auth/${path}`);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  if (!req.url.startsWith(`${base}/`)) {
    return next(req); // Not our API: no headers, no token leaves the app.
  }
  const session = inject(SessionStore);
  const refresher = inject(TokenRefresher);
  const router = inject(Router);
  const toast = inject(ToastService);
  const bearer = !NO_BEARER.includes(req.url.slice(base.length));

  /** Clears the session once, however many requests failed: one toast, one navigation. */
  const expire = (): Observable<never> => {
    if (session.isAuthenticated()) {
      const returnUrl = router.url;
      session.clear();
      toast.error(new ApiError('SESSION_EXPIRED'));
      void router.navigate(['/login'], { queryParams: { returnUrl } });
    }
    return throwError(() => new ApiError('SESSION_EXPIRED', { status: 401 }));
  };

  const send = (request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> => {
    const token = bearer ? session.accessToken() : null;
    const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return next(request.clone({ setHeaders: headers })).pipe(
      catchError((error: unknown) => {
        // Only a 401 of a protected endpoint while a session exists: an anonymous 401
        // (no session to restore) and the auth endpoints' own 401 go to the caller.
        if (!bearer || !isApiError(error) || error.status !== 401 || !session.isAuthenticated()) {
          return throwError(() => error);
        }
        if (request.context.get(RETRIED)) {
          return expire(); // AI-06: the fresh token is rejected too, no second refresh.
        }
        return refresher.refresh().pipe(
          // A refresh that is refused (401: invalid or rotated twice) ends the session;
          // the network or the server being down does not — that error goes to the caller.
          catchError((refreshError: unknown) =>
            isApiError(refreshError) && refreshError.status === 401
              ? expire()
              : throwError(() => refreshError),
          ),
          switchMap(() => send(markRetried(request))),
        );
      }),
    );
  };

  return send(req);
};

/**
 * The request marked as retried, on a copy of its context: `HttpContext` is shared between
 * clones, and the caller's own request must stay unmarked (an rxjs `retry()` resubscribes it).
 */
function markRetried(request: HttpRequest<unknown>): HttpRequest<unknown> {
  const context = new HttpContext();
  for (const key of request.context.keys()) {
    context.set(key, request.context.get(key));
  }
  return request.clone({ context: context.set(RETRIED, true) });
}
