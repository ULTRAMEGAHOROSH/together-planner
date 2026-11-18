// Route guards (FD-46, decisions §6): functional, read only SessionStore — the
// initializer (AUTH-05) has already set the status. Each fits canActivate and canMatch.
import { inject } from '@angular/core';
import { Router, type UrlTree } from '@angular/router';
import { SessionStore } from './session-store';

/** Signed in, or → `/login?returnUrl=<the requested URL>`. */
export function authGuard(): true | UrlTree {
  if (inject(SessionStore).isAuthenticated()) {
    return true;
  }
  const router = inject(Router);
  const requested = router.currentNavigation()?.extractedUrl;
  const returnUrl = requested ? router.serializeUrl(requested) : '/';
  return router.createUrlTree(['/login'], {
    queryParams: returnUrl === '/' ? {} : { returnUrl },
  });
}

/** Login and registration are for guests; a signed-in user → `/week`. */
export function guestGuard(): true | UrlTree {
  return inject(SessionStore).isAuthenticated() ? inject(Router).parseUrl('/week') : true;
}

/** The app itself needs a workspace, or → `/onboarding`. Goes after `authGuard`. */
export function workspaceGuard(): true | UrlTree {
  return inject(SessionStore).hasWorkspace() ? true : inject(Router).parseUrl('/onboarding');
}

/** Onboarding is only for a user without a workspace, or → `/week`. Goes after `authGuard`. */
export function noWorkspaceGuard(): true | UrlTree {
  return inject(SessionStore).hasWorkspace() ? inject(Router).parseUrl('/week') : true;
}

/**
 * `returnUrl` from the query, if it is a path inside the app; otherwise `null`.
 * `//evil.test` and `/\evil.test` are other sites for the browser, `https://…` too.
 */
export function safeReturnUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return null;
  }
  return value[1] === '/' || value[1] === '\\' ? null : value;
}
