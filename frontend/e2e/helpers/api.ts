// Data for E2E through the real backend (FD-88, QA-01): users, a workspace, invites, events,
// templates are made by the API, so a spec only drives the screen it is about. Every call
// carries its own Bearer token, so users never share a session; the refresh cookie the
// backend sets is never used here. Nothing is cleaned: a spec makes its own users
// (`e2e-<run>-<n>@example.test`) and never meets the data of another.
import type { APIRequestContext } from '@playwright/test';
import type { AuthResponse } from '../../src/app/core/api/models/auth.models';
import type { Uuid } from '../../src/app/core/api/models/common.models';
import type { EventRequest, EventResponse } from '../../src/app/core/api/models/event.models';
import type { EventUpdateRequest } from '../../src/app/core/api/events-api';
import type { WeekResponse } from '../../src/app/core/api/models/week.models';
import type {
  TemplateRequest,
  TemplateResponse,
} from '../../src/app/core/api/models/template.models';
import type {
  InviteResponse,
  WorkspaceResponse,
} from '../../src/app/core/api/models/workspace.models';

// Node's `process` (the project has no @types/node): only the environment is read.
declare const process: { env: Record<string, string | undefined> };

const API = '/api/v1';
/** The backend refuses a state-changing request without it (CSRF guard, spec §10). */
const HEADERS = { 'X-Requested-With': 'XMLHttpRequest' };

/**
 * Part of every e-mail, so reruns on the same DB do not clash. Every Playwright worker loads
 * this file on its own, so a random tail keeps parallel workers apart; `E2E_RUN_ID` pins it.
 */
export const RUN_ID =
  process.env['E2E_RUN_ID'] ??
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** A password of a made-up user: long enough for the rules (8+), the same for all. */
export const E2E_PASSWORD = 'E2e-password-1';
export const DEFAULT_TIME_ZONE = 'Asia/Almaty';

let counter = 0;

export interface TestUser {
  readonly id: Uuid;
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  /** Bearer for the API helpers; the browser signs in on its own (`loginViaUi`). */
  readonly accessToken: string;
}

/** A failed API call says what was asked and what came back, so a spec fails readably. */
async function send<T>(
  request: APIRequestContext,
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  options: { token?: string; data?: unknown } = {},
): Promise<T> {
  const response = await request[method](`${API}${path}`, {
    headers: {
      ...HEADERS,
      ...(options.token === undefined ? {} : { Authorization: `Bearer ${options.token}` }),
    },
    data: options.data,
  });
  if (!response.ok()) {
    throw new Error(
      `${method.toUpperCase()} ${API}${path} → ${response.status()}: ${await response.text()}`,
    );
  }
  // 204 (DELETE) has no body.
  return (response.status() === 204 ? undefined : await response.json()) as T;
}

export interface Credentials {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

/** A unique e-mail and the common password for a user who is made on the screen, not by A1. */
export function newCredentials(name?: string): Credentials {
  counter += 1;
  return {
    email: `e2e-${RUN_ID}-${counter}@example.test`,
    password: E2E_PASSWORD,
    displayName: name ?? `Тестер ${counter}`,
  };
}

/** A1: a new user with a unique e-mail. `name` is the display name (default «Тестер n»). */
export async function registerUser(request: APIRequestContext, name?: string): Promise<TestUser> {
  const { email, password, displayName } = newCredentials(name);
  const auth = await send<AuthResponse>(request, 'post', '/auth/register', {
    data: { email, password, displayName },
  });
  return { id: auth.user.id, email, password, displayName, accessToken: auth.accessToken };
}

/** W1: the user's workspace (they become its first member). */
export function createWorkspace(
  request: APIRequestContext,
  user: TestUser,
  options: { name?: string; timeZone?: string } = {},
): Promise<WorkspaceResponse> {
  return send<WorkspaceResponse>(request, 'post', '/workspaces', {
    token: user.accessToken,
    data: {
      name: options.name ?? `Пространство ${RUN_ID}`,
      timeZone: options.timeZone ?? DEFAULT_TIME_ZONE,
    },
  });
}

/** W5: a new invite code (the previous one stops working). */
export function createInvite(
  request: APIRequestContext,
  user: TestUser,
  workspaceId: Uuid,
): Promise<InviteResponse> {
  return send<InviteResponse>(request, 'post', `/workspaces/${workspaceId}/invites`, {
    token: user.accessToken,
  });
}

/** W6: the user joins the workspace with the code. */
export function join(
  request: APIRequestContext,
  user: TestUser,
  code: string,
): Promise<WorkspaceResponse> {
  return send<WorkspaceResponse>(request, 'post', '/workspaces/join', {
    token: user.accessToken,
    data: { code },
  });
}

/** E3: an event; `body` is the whole request (participants are user ids). */
export function createEvent(
  request: APIRequestContext,
  user: TestUser,
  workspaceId: Uuid,
  body: EventRequest,
): Promise<EventResponse> {
  return send<EventResponse>(request, 'post', `/workspaces/${workspaceId}/events`, {
    token: user.accessToken,
    data: body,
  });
}

/** E5: the event is changed (as the partner would); `body.version` is the one the caller saw. */
export function updateEvent(
  request: APIRequestContext,
  user: TestUser,
  workspaceId: Uuid,
  eventId: Uuid,
  body: EventUpdateRequest,
): Promise<EventResponse> {
  return send<EventResponse>(request, 'put', `/workspaces/${workspaceId}/events/${eventId}`, {
    token: user.accessToken,
    data: body,
  });
}

/** S1: the week as the backend gives it (to check what the screen did, not how it looks). */
export function getWeek(
  request: APIRequestContext,
  user: TestUser,
  workspaceId: Uuid,
  weekStart: string,
): Promise<WeekResponse> {
  return send<WeekResponse>(request, 'get', `/workspaces/${workspaceId}/week?date=${weekStart}`, {
    token: user.accessToken,
  });
}

/** E6: the event is deleted; `version` is the one the caller saw. */
export function deleteEvent(
  request: APIRequestContext,
  user: TestUser,
  workspaceId: Uuid,
  eventId: Uuid,
  version: number,
): Promise<void> {
  return send<void>(
    request,
    'delete',
    `/workspaces/${workspaceId}/events/${eventId}?version=${version}`,
    { token: user.accessToken },
  );
}

/** T4: the template is changed; `body.version` is the one the caller saw. */
export function updateTemplate(
  request: APIRequestContext,
  user: TestUser,
  workspaceId: Uuid,
  templateId: Uuid,
  body: TemplateRequest & { version: number },
): Promise<TemplateResponse> {
  return send<TemplateResponse>(
    request,
    'put',
    `/workspaces/${workspaceId}/templates/${templateId}`,
    { token: user.accessToken, data: body },
  );
}

/** T2: a template; `body` is the whole request. */
export function createTemplate(
  request: APIRequestContext,
  user: TestUser,
  workspaceId: Uuid,
  body: TemplateRequest,
): Promise<TemplateResponse> {
  return send<TemplateResponse>(request, 'post', `/workspaces/${workspaceId}/templates`, {
    token: user.accessToken,
    data: body,
  });
}
