// Session restore before the first navigation (FD-39): guards (AUTH-06) run after it and
// already know the status, so the login page does not flash on F5 for a signed-in user.
import { type EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { AuthService } from './auth-service';

export function provideSessionRestore(): EnvironmentProviders {
  return provideAppInitializer(() => inject(AuthService).restore());
}
