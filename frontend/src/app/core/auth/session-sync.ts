// Sign-out in every tab (AUTH-09): the tab that signs out tells the others over a
// BroadcastChannel, and they forget the session and go to /login. Only «logout» travels: no
// token and no personal data cross the channel. Where there is no BroadcastChannel
// (old browsers, some privacy modes) nothing happens and each tab behaves as before.
import { DestroyRef, inject, Injectable, InjectionToken } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from './session-store';

/** The part of BroadcastChannel that is used; a test supplies its own. */
export interface SessionChannel {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export const SESSION_CHANNEL_NAME = 'tp-session';
export const LOGOUT_MESSAGE = 'logout';

/** Opens the channel, or `null` when the browser has none. */
export const SESSION_CHANNEL = new InjectionToken<() => SessionChannel | null>('SESSION_CHANNEL', {
  providedIn: 'root',
  factory: () => () => {
    try {
      return typeof BroadcastChannel === 'undefined'
        ? null
        : (new BroadcastChannel(SESSION_CHANNEL_NAME) as SessionChannel);
    } catch {
      return null;
    }
  },
});

@Injectable({ providedIn: 'root' })
export class SessionSync {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly channel: SessionChannel | null;

  constructor() {
    this.channel = inject(SESSION_CHANNEL)();
    if (this.channel !== null) {
      this.channel.onmessage = (event) => {
        if (event.data === LOGOUT_MESSAGE) {
          this.onRemoteLogout();
        }
      };
      inject(DestroyRef).onDestroy(() => this.channel?.close());
    }
  }

  /** This tab signed out (A4 or A5): the other tabs follow. */
  announceLogout(): void {
    try {
      this.channel?.postMessage(LOGOUT_MESSAGE);
    } catch {
      // A closed channel must not break signing out.
    }
  }

  /** Another tab signed out: forget the session here without announcing it again. */
  private onRemoteLogout(): void {
    if (!this.session.isAuthenticated()) {
      return;
    }
    this.session.clear();
    void this.router.navigateByUrl('/login');
  }
}
