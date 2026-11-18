// Single-flight refresh of the access token (decisions §5.2). Parallel 401s share one
// A3 request; the only state is that request while it is in flight.
import { inject, Injectable } from '@angular/core';
import { catchError, finalize, map, type Observable, shareReplay, tap, throwError } from 'rxjs';
import { AuthApi } from '../api/auth-api';
import { isApiError } from '../error/api-error';
import { SessionStore } from './session-store';

@Injectable({ providedIn: 'root' })
export class TokenRefresher {
  private readonly api = inject(AuthApi);
  private readonly session = inject(SessionStore);
  private inFlight: Observable<string> | null = null;

  /**
   * The new access token, already put into `SessionStore`. While a refresh is in flight,
   * every caller gets the same Observable. `REFRESH_TOKEN_ROTATED` (another tab rotated the
   * cookie a moment ago, spec §10.4) is retried once: the browser already holds the new
   * cookie. Any other error goes to the caller, who decides what to do (AUTH-04, AUTH-05).
   */
  refresh(): Observable<string> {
    this.inFlight ??= this.api.refresh().pipe(
      catchError((error: unknown) =>
        isApiError(error) && error.code === 'REFRESH_TOKEN_ROTATED'
          ? this.api.refresh()
          : throwError(() => error),
      ),
      tap((response) => this.session.setAuth(response)),
      map((response) => response.accessToken),
      // On success or error: the next call starts a new request.
      finalize(() => (this.inFlight = null)),
      // refCount: false — a caller that unsubscribes does not cancel it for the others.
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.inFlight;
  }
}
