import { InjectionToken } from '@angular/core';

/**
 * Base path of the backend REST API (spec §8). Same value everywhere (FD-07):
 * the dev server proxies /api to the backend (proxy.conf.json), nginx does it in production.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api/v1',
});
