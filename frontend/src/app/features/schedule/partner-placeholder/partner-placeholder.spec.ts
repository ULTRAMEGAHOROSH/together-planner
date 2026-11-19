import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AUTH_RESPONSE, WORKSPACE_CREATED } from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { PartnerPlaceholder } from './partner-placeholder';

describe('tp-partner-placeholder (WEEK-10)', () => {
  it('says the partner has not joined and offers the invite card, which asks for nothing yet', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_CREATED);
    const fixture = TestBed.createComponent(PartnerPlaceholder);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.head')?.textContent).toContain('Партнёр ещё не присоединился');
    expect(host.querySelector('tp-invite-card')?.textContent).toContain('Получить код');
    // Looking at the card must not issue (and so cancel) a code (W5).
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
