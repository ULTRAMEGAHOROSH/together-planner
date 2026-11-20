// History endpoint T8 (spec §8.9, backend: template/controller/TemplateApplicationController.java).
// HTTP only: no state, no error handling (Bearer and headers: authInterceptor).
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type { PageResponse, Uuid } from './models/common.models';
import type { TemplateApplicationResponse } from './models/template.models';

@Injectable({ providedIn: 'root' })
export class TemplateApplicationsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/workspaces`;

  /**
   * T8 `GET …/template-applications?page=&size=`: history by `applied_at` descending.
   * `page` is zero-based.
   */
  history(
    wsId: Uuid,
    page: number,
    size: number,
  ): Observable<PageResponse<TemplateApplicationResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<TemplateApplicationResponse>>(
      `${this.base}/${wsId}/template-applications`,
      { params },
    );
  }
}
