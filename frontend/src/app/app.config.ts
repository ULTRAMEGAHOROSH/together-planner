import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeRu from '@angular/common/locales/ru';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { errorInterceptor } from '@core/error/error-interceptor';

// Russian only (FD-06): number/date pipes use the ru locale data.
registerLocaleData(localeRu);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Order: authInterceptor (AUTH-04) goes first, so it already sees ApiError.
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor])),
    { provide: LOCALE_ID, useValue: 'ru' },
  ],
};
