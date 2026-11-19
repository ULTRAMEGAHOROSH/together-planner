// Week endpoint S1 (spec §8.5, backend: schedule/controller/WeekController.java).
// HTTP only: no state, no error handling (Bearer and headers: authInterceptor).
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type { IsoDate, Uuid } from './models/common.models';
import type { WeekResponse } from './models/week.models';

@Injectable({ providedIn: 'root' })
export class WeekApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/workspaces`;

  /**
   * S1 `GET /workspaces/{wsId}/week?date=`: the week that contains `date` (the backend
   * snaps it to Monday); without `date` — the current week in the workspace zone.
   */
  get(wsId: Uuid, date?: IsoDate): Observable<WeekResponse> {
    const params = date === undefined ? new HttpParams() : new HttpParams().set('date', date);
    return this.http.get<WeekResponse>(`${this.base}/${wsId}/week`, { params });
  }
}
