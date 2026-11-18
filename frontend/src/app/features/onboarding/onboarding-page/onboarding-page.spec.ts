import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AUTH_RESPONSE, WORKSPACE_CREATED } from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { OnboardingPage } from './onboarding-page';

describe('OnboardingPage', () => {
  let fixture: ComponentFixture<OnboardingPage>;

  const page = () => fixture.nativeElement as HTMLElement;
  const headings = () => Array.from(page().querySelectorAll('h2'), (h) => h.textContent?.trim());

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(SessionStore).setAuth(AUTH_RESPONSE);
    fixture = TestBed.createComponent(OnboardingPage);
    await fixture.whenStable();
  });

  it('shows the prototype text and both paths, each a named section', () => {
    expect(page().querySelector('h1')?.textContent).toBe('Общее пространство');
    expect(page().textContent).toContain('В пространстве максимум два человека.');
    expect(headings()).toEqual(['Создать пространство', 'У меня есть код']);
    const sections = Array.from(page().querySelectorAll('section'));
    expect(
      sections.map((s) => document.getElementById(s.getAttribute('aria-labelledby')!)),
    ).toEqual(Array.from(page().querySelectorAll('h2')));
    expect(page().querySelector('button')).toBeNull();
  });

  it('after the workspace is created: its name, no join path, «К расписанию» → /week', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    TestBed.inject(SessionStore).setWorkspace(WORKSPACE_CREATED);
    fixture.componentInstance.showCreated();
    await fixture.whenStable();

    expect(headings()).toEqual(['Пространство «Мы» создано']);
    const button = page().querySelector('button')!;
    expect(button.textContent?.trim()).toBe('К расписанию');
    button.click();
    expect(navigate).toHaveBeenCalledWith('/week');
  });
});
