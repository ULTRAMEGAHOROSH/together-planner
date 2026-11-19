import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeRu from '@angular/common/locales/ru';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from '@core/auth/auth-interceptor';
import { provideSessionRestore } from '@core/auth/session-initializer';
import { provideWorkspaceRefresh } from '@core/auth/workspace-refresh';
import { errorInterceptor } from '@core/error/error-interceptor';

// Russian only (FD-06): number/date pipes use the ru locale data.
registerLocaleData(localeRu);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Order: authInterceptor first, so the errors it sees are already ApiError (AUTH-04).
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    // Restores the session before the first navigation (AUTH-05).
    provideSessionRestore(),
    // Sees the partner join when the tab comes back (WS-07).
    provideWorkspaceRefresh(),
    { provide: LOCALE_ID, useValue: 'ru' },
  ],
};
