import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AUTH_RESPONSE, WORKSPACE_FULL_PAIR } from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { AppShell } from './app-shell';

@Component({ template: '<h1>Страница</h1>' })
class Page {}

describe('AppShell', () => {
  it('the header on top, the routed page inside main', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: '', component: AppShell, children: [{ path: 'week', component: Page }] },
        ]),
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/week');

    const shell = harness.routeNativeElement as HTMLElement;
    expect(shell.tagName.toLowerCase()).toBe('tp-app-shell');
    const [header, main] = Array.from(shell.children);
    expect(header.tagName.toLowerCase()).toBe('tp-app-header');
    expect(main.tagName.toLowerCase()).toBe('main');
    expect(main.querySelector('h1')?.textContent).toBe('Страница');
  });
});
