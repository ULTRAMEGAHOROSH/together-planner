// Real backend responses captured from the running backend (2026-11-17), used as
// compile-time contract checks (`satisfies`) and as fixtures in tests.
// Access tokens are replaced with a fake value; everything else is verbatim.
// Grows in CORE-03 with week, event and template samples.
import type { ProblemDetail } from '../common.models';
import type { AuthResponse, MeResponse } from '../auth.models';
import type { UserResponse } from '../user.models';
import type { InviteResponse, WorkspaceResponse } from '../workspace.models';

// --- Errors (spec §7.1) ---

export const PROBLEM_VALIDATION = {
  detail: 'Invalid request content.',
  instance: '/api/v1/auth/register',
  status: 400,
  title: 'Bad Request',
  code: 'VALIDATION_FAILED',
  errors: [
    { field: 'email', message: 'должно иметь формат адреса электронной почты' },
    { field: 'displayName', message: 'не должно быть пустым' },
    { field: 'password', message: 'размер должен находиться в диапазоне от 8 до 72' },
  ],
} satisfies ProblemDetail;

export const PROBLEM_MALFORMED = {
  detail: 'Failed to read request',
  instance: '/api/v1/auth/login',
  status: 400,
  title: 'Bad Request',
  code: 'MALFORMED_REQUEST',
} satisfies ProblemDetail;

export const PROBLEM_CSRF = {
  detail: 'Missing or invalid X-Requested-With header',
  instance: '/api/v1/auth/login',
  status: 403,
  title: 'Forbidden',
  code: 'CSRF_HEADER_MISSING',
} satisfies ProblemDetail;

export const PROBLEM_INVALID_CREDENTIALS = {
  detail: 'Invalid email or password',
  instance: '/api/v1/auth/login',
  status: 401,
  title: 'Unauthorized',
  code: 'INVALID_CREDENTIALS',
} satisfies ProblemDetail;

export const PROBLEM_UNAUTHORIZED = {
  detail: 'Authentication required',
  instance: '/api/v1/auth/me',
  status: 401,
  title: 'Unauthorized',
  code: 'UNAUTHORIZED',
} satisfies ProblemDetail;

export const PROBLEM_INVITE_NOT_FOUND = {
  detail: 'Invite not found',
  instance: '/api/v1/workspaces/join',
  status: 404,
  title: 'Not Found',
  code: 'INVITE_NOT_FOUND',
} satisfies ProblemDetail;

// --- Auth and workspace (spec §8.3, §8.4) ---
// Scenario: A registers ("Core02-A-…@Example.TEST" → stored lower-cased), creates the
// workspace "  Мы " (→ trimmed), creates an invite; B registers and joins with the
// lower-case dashed code "acz9-axjn".

const USER_A = {
  id: '01a1e930-1c31-7237-bc04-8ba90b379006',
  email: 'core02-a-1794913605@example.test',
  displayName: 'Даулет',
  createdAt: '2026-11-17T11:06:46.705139Z',
} satisfies UserResponse;

/** A1 — 201, plus cookie `tp_refresh` (Path=/api/v1/auth; HttpOnly; SameSite=Strict). */
export const AUTH_RESPONSE = {
  accessToken: 'eyJ.fake-access-token.sample',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: USER_A,
} satisfies AuthResponse;

/** A6 before the workspace exists. */
export const ME_WITHOUT_WORKSPACE = {
  user: USER_A,
  workspace: null,
} satisfies MeResponse;

/** W1 — 201. Instants keep the backend precision (here 9 fractional digits). */
export const WORKSPACE_CREATED = {
  id: '01a1e930-1ee9-7cb8-a035-97cbf0317f42',
  name: 'Мы',
  timeZone: 'Asia/Almaty',
  members: [
    {
      userId: '01a1e930-1c31-7237-bc04-8ba90b379006',
      displayName: 'Даулет',
      role: 'OWNER',
      seat: 1,
      joinedAt: '2026-11-17T11:06:47.400720200Z',
    },
  ],
  createdAt: '2026-11-17T11:06:47.400720200Z',
} satisfies WorkspaceResponse;

/** W5 — 201. */
export const INVITE = {
  code: 'ACZ9AXJN',
  displayCode: 'ACZ9-AXJN',
  expiresAt: '2026-11-24T11:06:48.004457800Z',
} satisfies InviteResponse;

/** W6 — 200, both seats taken (6 fractional digits once read back from the database). */
export const WORKSPACE_FULL_PAIR = {
  id: '01a1e930-1ee9-7cb8-a035-97cbf0317f42',
  name: 'Мы',
  timeZone: 'Asia/Almaty',
  members: [
    {
      userId: '01a1e930-1c31-7237-bc04-8ba90b379006',
      displayName: 'Даулет',
      role: 'OWNER',
      seat: 1,
      joinedAt: '2026-11-17T11:06:47.400720Z',
    },
    {
      userId: '01a1e930-23f7-721b-ac06-2cacc2d5ed2b',
      displayName: 'Партнёр',
      role: 'MEMBER',
      seat: 2,
      joinedAt: '2026-11-17T11:06:49.589213200Z',
    },
  ],
  createdAt: '2026-11-17T11:06:47.400720Z',
} satisfies WorkspaceResponse;

/** A6 after the partner joined. */
export const ME_WITH_WORKSPACE = {
  user: USER_A,
  workspace: {
    ...WORKSPACE_FULL_PAIR,
    members: [
      WORKSPACE_FULL_PAIR.members[0],
      { ...WORKSPACE_FULL_PAIR.members[1], joinedAt: '2026-11-17T11:06:49.589213Z' },
    ],
  },
} satisfies MeResponse;

/** All ProblemDetail samples, for tests that iterate over them. */
export const PROBLEM_SAMPLES: readonly ProblemDetail[] = [
  PROBLEM_VALIDATION,
  PROBLEM_MALFORMED,
  PROBLEM_CSRF,
  PROBLEM_INVALID_CREDENTIALS,
  PROBLEM_UNAUTHORIZED,
  PROBLEM_INVITE_NOT_FOUND,
];
