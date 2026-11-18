// Workspace endpoints W1–W6 (spec §8.4, backend: workspace/controller/WorkspaceController.java).
// HTTP only: no state, no error handling (Bearer and headers: authInterceptor).
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import type { Uuid } from './models/common.models';
import type {
  CreateWorkspaceRequest,
  InviteResponse,
  JoinWorkspaceRequest,
  MemberResponse,
  UpdateWorkspaceRequest,
  WorkspaceResponse,
} from './models/workspace.models';

@Injectable({ providedIn: 'root' })
export class WorkspaceApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/workspaces`;

  /** W1 `POST /workspaces` → 201; the creator takes seat 1. */
  create(body: CreateWorkspaceRequest): Observable<WorkspaceResponse> {
    return this.http.post<WorkspaceResponse>(this.base, body);
  }

  /** W2 `GET /workspaces/current`; 404 `WORKSPACE_NOT_FOUND` without one. */
  current(): Observable<WorkspaceResponse> {
    return this.http.get<WorkspaceResponse>(`${this.base}/current`);
  }

  /** W3 `PATCH /workspaces/{wsId}`: a missing or `null` field is left as it is. */
  update(wsId: Uuid, body: UpdateWorkspaceRequest): Observable<WorkspaceResponse> {
    return this.http.patch<WorkspaceResponse>(`${this.base}/${wsId}`, body);
  }

  /** W4 `GET /workspaces/{wsId}/members`, sorted by seat. */
  members(wsId: Uuid): Observable<MemberResponse[]> {
    return this.http.get<MemberResponse[]>(`${this.base}/${wsId}/members`);
  }

  /** W5 `POST /workspaces/{wsId}/invites` → 201, no body; a code valid for 7 days. */
  createInvite(wsId: Uuid): Observable<InviteResponse> {
    return this.http.post<InviteResponse>(`${this.base}/${wsId}/invites`, null);
  }

  /** W6 `POST /workspaces/join` with the code as typed (the backend normalizes it). */
  join(body: JoinWorkspaceRequest): Observable<WorkspaceResponse> {
    return this.http.post<WorkspaceResponse>(`${this.base}/join`, body);
  }
}
