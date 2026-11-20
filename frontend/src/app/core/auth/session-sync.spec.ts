import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AUTH_RESPONSE } from '../api/models/testing/samples';
import { SessionStore } from './session-store';
import { LOGOUT_MESSAGE, SESSION_CHANNEL, SessionSync, type SessionChannel } from './session-sync';

class FakeChannel implements SessionChannel {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  readonly sent: unknown[] = [];
  closed = false;
  postMessage(message: unknown): void {
    this.sent.push(message);
  }
  close(): void {
    this.closed = true;
  }
  receive(data: unknown): void {
    this.onmessage?.({ data });
  }
}

describe('SessionSync (AUTH-09)', () => {
  let channel: FakeChannel;
  let session: SessionStore;
  let navigate: ReturnType<typeof vi.fn>;

  function setup(factory: () => SessionChannel | null) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SESSION_CHANNEL, useValue: factory }],
    });
    session = TestBed.inject(SessionStore);
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.inject(Router).navigateByUrl = navigate as never;
    return TestBed.inject(SessionSync);
  }

  beforeEach(() => {
    channel = new FakeChannel();
  });

  it('a logout from another tab clears the session and opens /login', () => {
    setup(() => channel);
    session.setAuth(AUTH_RESPONSE);
    channel.receive(LOGOUT_MESSAGE);
    expect(session.status()).toBe('anonymous');
    expect(navigate).toHaveBeenCalledWith('/login');
    expect(channel.sent).toEqual([]); // it does not echo back
  });

  it('other messages and a tab that is already signed out change nothing', () => {
    setup(() => channel);
    session.setAuth(AUTH_RESPONSE);
    channel.receive('something else');
    channel.receive({ type: LOGOUT_MESSAGE });
    expect(session.status()).toBe('authenticated');
    session.clear();
    channel.receive(LOGOUT_MESSAGE);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('announceLogout sends only the word «logout»', () => {
    const sync = setup(() => channel);
    sync.announceLogout();
    expect(channel.sent).toEqual([LOGOUT_MESSAGE]);
  });

  it('the channel is closed with the app', () => {
    setup(() => channel);
    TestBed.resetTestingModule();
    expect(channel.closed).toBe(true);
  });

  it('without BroadcastChannel nothing breaks', () => {
    const sync = setup(() => null);
    expect(() => sync.announceLogout()).not.toThrow();
  });

  it('a channel that throws on send does not break signing out', () => {
    channel.postMessage = () => {
      throw new Error('closed');
    };
    const sync = setup(() => channel);
    expect(() => sync.announceLogout()).not.toThrow();
  });
});
