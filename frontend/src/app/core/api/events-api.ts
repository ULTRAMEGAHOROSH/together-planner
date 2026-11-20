// Event endpoints E1–E6 (spec §8.6, backend: event/controller/EventController.java).
// HTTP only: no state, no error handling (Bearer and headers: authInterceptor).
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type { IsoDate, PageResponse, Uuid } from './models/common.models';
import type { EventRequest, EventResponse } from './models/event.models';

/** E5 body: the `version` the client saw is required (D-6). */
export type EventUpdateRequest = EventRequest & { version: number };

@Injectable({ providedIn: 'root' })
export class EventsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/workspaces`;

  private url(wsId: Uuid, tail = ''): string {
    return `${this.base}/${wsId}/events${tail}`;
  }

  /**
   * E1 `GET …/events?from=&to=`: events that overlap the days `from`…`to` (both inclusive),
   * by `(start, id)`. At most 93 days, else `400 INVALID_DATE_RANGE`.
   */
  range(wsId: Uuid, from: IsoDate, to: IsoDate): Observable<EventResponse[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<EventResponse[]>(this.url(wsId), { params });
  }

  /**
   * E2 `GET …/events/upcoming?page=&size=`: events that have not ended yet (running ones
   * included), by `(start, id)`. `page` is zero-based, `size` 1…100.
   */
  upcoming(wsId: Uuid, page: number, size: number): Observable<PageResponse<EventResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<EventResponse>>(this.url(wsId, '/upcoming'), { params });
  }

  /** E3 `POST …/events` → 201: always a manual event (`source = null`). */
  create(wsId: Uuid, body: EventRequest): Observable<EventResponse> {
    return this.http.post<EventResponse>(this.url(wsId), body);
  }

  /** E4 `GET …/events/{eventId}`; 404 `EVENT_NOT_FOUND`. */
  get(wsId: Uuid, eventId: Uuid): Observable<EventResponse> {
    return this.http.get<EventResponse>(this.url(wsId, `/${eventId}`));
  }

  /** E5 `PUT …/events/{eventId}`: 409 `VERSION_CONFLICT` if `version` is not the current one. */
  update(wsId: Uuid, eventId: Uuid, body: EventUpdateRequest): Observable<EventResponse> {
    return this.http.put<EventResponse>(this.url(wsId, `/${eventId}`), body);
  }

  /**
   * E6 `DELETE …/events/{eventId}?version=` → 204. The version is always sent: without it
   * the backend answers `400 VERSION_REQUIRED` (D-6).
   */
  delete(wsId: Uuid, eventId: Uuid, version: number): Observable<void> {
    const params = new HttpParams().set('version', version);
    return this.http.delete<void>(this.url(wsId, `/${eventId}`), { params });
  }
}
