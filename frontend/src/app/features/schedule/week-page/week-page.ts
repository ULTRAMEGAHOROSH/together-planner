import { Component, inject, input, signal } from '@angular/core';
import { AuthService } from '@core/auth/auth-service';
import { Button } from '@shared/ui/button/button';

// Placeholder (FND-05). Real page: WEEK-10.
@Component({
  selector: 'tp-week-page',
  imports: [Button],
  template: `
    <h1>Расписание</h1>
    @if (weekStart(); as start) {
      <p>Неделя с {{ start }}</p>
    }
    <!-- Temporary (AUTH-08): moves to the user menu in SHELL-02. -->
    <button tpButton variant="ghost" type="button" [loading]="leaving()" (click)="logout()">
      Выйти
    </button>
  `,
})
export class WeekPage {
  readonly weekStart = input<string>();

  private readonly auth = inject(AuthService);
  protected readonly leaving = signal(false);

  protected logout(): void {
    this.leaving.set(true);
    this.auth.logout().subscribe();
  }
}
