// Template endpoints T1–T7 (spec §8.7, §8.8, backend: template/controller/TemplateController.java).
// HTTP only: no state, no error handling (Bearer and headers: authInterceptor).
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type { Uuid } from './models/common.models';
import type {
  ApplyPreviewResponse,
  ApplyResultResponse,
  ApplyTemplateRequest,
  TemplateRequest,
  TemplateResponse,
} from './models/template.models';

/** T4 body: the `version` the client saw is required (D-6). */
export type TemplateUpdateRequest = TemplateRequest & { version: number };

@Injectable({ providedIn: 'root' })
export class TemplatesApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/workspaces`;

  private url(wsId: Uuid, tail = ''): string {
    return `${this.base}/${wsId}/templates${tail}`;
  }

  /** T1 `GET …/templates`: all templates of the workspace. */
  list(wsId: Uuid): Observable<TemplateResponse[]> {
    return this.http.get<TemplateResponse[]>(this.url(wsId));
  }

  /** T2 `POST …/templates` → 201. */
  create(wsId: Uuid, body: TemplateRequest): Observable<TemplateResponse> {
    return this.http.post<TemplateResponse>(this.url(wsId), body);
  }

  /** T3 `GET …/templates/{templateId}`; 404 `TEMPLATE_NOT_FOUND`. */
  get(wsId: Uuid, templateId: Uuid): Observable<TemplateResponse> {
    return this.http.get<TemplateResponse>(this.url(wsId, `/${templateId}`));
  }

  /**
   * T4 `PUT …/templates/{templateId}`: events keep their `id` (diff by id, §9.8);
   * 409 `VERSION_CONFLICT` if `version` is not the current one.
   */
  update(wsId: Uuid, templateId: Uuid, body: TemplateUpdateRequest): Observable<TemplateResponse> {
    return this.http.put<TemplateResponse>(this.url(wsId, `/${templateId}`), body);
  }

  /**
   * T5 `DELETE …/templates/{templateId}?version=` → 204. The version is always sent:
   * without it the backend answers `400 VERSION_REQUIRED` (D-6).
   */
  delete(wsId: Uuid, templateId: Uuid, version: number): Observable<void> {
    const params = new HttpParams().set('version', version);
    return this.http.delete<void>(this.url(wsId, `/${templateId}`), { params });
  }

  /** T6 `POST …/templates/{templateId}/apply/preview`: the backend's plan, nothing is saved. */
  preview(
    wsId: Uuid,
    templateId: Uuid,
    body: ApplyTemplateRequest,
  ): Observable<ApplyPreviewResponse> {
    return this.http.post<ApplyPreviewResponse>(
      this.url(wsId, `/${templateId}/apply/preview`),
      body,
    );
  }

  /** T7 `POST …/templates/{templateId}/apply` → 200 (not 201): creates the events. */
  apply(wsId: Uuid, templateId: Uuid, body: ApplyTemplateRequest): Observable<ApplyResultResponse> {
    return this.http.post<ApplyResultResponse>(this.url(wsId, `/${templateId}/apply`), body);
  }
}
