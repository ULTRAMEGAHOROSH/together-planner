import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth-service';
import { EMPTY } from 'rxjs';
import { WeekPage } from './week-page';

describe('WeekPage placeholder: temporary sign-out (AUTH-08)', () => {
  it('«Выйти» calls AuthService.logout once and shows that it is busy', async () => {
    const logout = vi.fn(() => EMPTY);
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { logout } }] });
    const fixture = TestBed.createComponent(WeekPage);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.textContent?.trim()).toBe('Выйти');

    button.click();
    await fixture.whenStable();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-busy')).toBe('true');
    button.click(); // blocked while busy
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
