// Auth endpoints A1–A6 (spec §8.3, backend: auth/controller/AuthController.java).
// HTTP only: no state, no error handling. The headers (X-Requested-With, Bearer) are
// added by authInterceptor (FD-37, FD-38); the refresh cookie `tp_refresh` is sent by the
// browser itself (FD-36).
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type { AuthResponse, LoginRequest, MeResponse, RegisterRequest } from './models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/auth`;

  /** A1 `POST /auth/register` → 201 and the refresh cookie. */
  register(body: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/register`, body);
  }

  /** A2 `POST /auth/login` → 200 and the refresh cookie. */
  login(body: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/login`, body);
  }

  /** A3 `POST /auth/refresh`: the cookie is the credential; rotates it. */
  refresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/refresh`, null);
  }

  /** A4 `POST /auth/logout` → 204: revokes the cookie's token and clears the cookie. */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/logout`, null);
  }

  /** A5 `POST /auth/logout-all` → 204: revokes every session of the user (needs Bearer). */
  logoutAll(): Observable<void> {
    return this.http.post<void>(`${this.base}/logout-all`, null);
  }

  /** A6 `GET /auth/me`: the user and their workspace (`null` before onboarding). */
  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.base}/me`);
  }
}
