import { ChangeDetectionStrategy, Component } from '@angular/core';

// Placeholder (FND-05). Real page: AUTH-07.
@Component({
  selector: 'tp-auth-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Вход и регистрация</h1>`,
})
export class AuthPage {}
