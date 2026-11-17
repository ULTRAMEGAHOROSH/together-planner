// Real backend responses captured from the running backend (2026-11-17), used as
// compile-time contract checks (`satisfies`) and as fixtures in tests.
// Access tokens are replaced with a fake value; everything else is verbatim.
import type { PageResponse, ProblemDetail } from '../common.models';
import type { AuthResponse, MeResponse } from '../auth.models';
import type { EventResponse } from '../event.models';
import type {
  ApplyPreviewResponse,
  ApplyResultResponse,
  TemplateApplicationResponse,
  TemplateResponse,
} from '../template.models';
import type { UserResponse } from '../user.models';
import type { WeekResponse } from '../week.models';
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

// --- Events, week, templates (spec §8.5–8.9) ---
// Captured from a second test pair (workspace 'Мы', Asia/Almaty) on 2026-11-17, week
// 2026-11-23…29. Scenario: 4 manual events (E3), template with 3 events (T2), MERGE (T7),
// one created occurrence deleted, previews (T6), REPLACE (T7), then the template deleted.

/** E3: manual, one participant, no description, category color. */
export const EVENT_CREATED_MANUAL = {
  id: '01a1e936-3d43-7d0b-b3e2-bf1906d5aa07',
  title: 'Работа',
  description: null,
  start: '2026-11-23T09:00:00',
  end: '2026-11-23T18:00:00',
  participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
  category: 'WORK',
  color: null,
  source: null,
  createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
  updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
  createdAt: '2026-11-17T11:13:28.385082300Z',
  updatedAt: '2026-11-17T11:13:28.385082300Z',
  version: 0,
} satisfies EventResponse;

/** E3: joint event with description and explicit color. */
export const EVENT_CREATED_JOINT = {
  id: '01a1e936-3db8-71b3-ae71-593e8f97b638',
  title: 'Ужин вместе',
  description: 'Столик на 19:30',
  start: '2026-11-25T19:00:00',
  end: '2026-11-25T21:00:00',
  participantIds: ['01a1e936-3c7b-7aa9-a61b-e55f056e66c1', '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
  category: 'TOGETHER',
  color: 'FOOD',
  source: null,
  createdBy: '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
  updatedBy: '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
  createdAt: '2026-11-17T11:13:28.504106400Z',
  updatedAt: '2026-11-17T11:13:28.504106400Z',
  version: 0,
} satisfies EventResponse;

/** E3: crosses the end of the week (Sunday 22:00 → Monday 06:00). */
export const EVENT_CROSS_WEEK = {
  id: '01a1e936-3dee-7f8e-963e-3fcb9658277e',
  title: 'Поезд',
  description: null,
  start: '2026-11-29T22:00:00',
  end: '2026-11-30T06:00:00',
  participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
  category: 'TRIP',
  color: null,
  source: null,
  createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
  updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
  createdAt: '2026-11-17T11:13:28.558972400Z',
  updatedAt: '2026-11-17T11:13:28.558972400Z',
  version: 0,
} satisfies EventResponse;

/** E5: update — version grows, updatedAt changes. */
export const EVENT_UPDATED = {
  id: '01a1e936-3d43-7d0b-b3e2-bf1906d5aa07',
  title: 'Работа (офис)',
  description: null,
  start: '2026-11-23T09:00:00',
  end: '2026-11-23T17:00:00',
  participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
  category: 'WORK',
  color: null,
  source: null,
  createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
  updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
  createdAt: '2026-11-17T11:13:28.385082Z',
  updatedAt: '2026-11-17T11:13:29.695641700Z',
  version: 1,
} satisfies EventResponse;

/** E2: upcoming events, first page of size 2. */
export const EVENT_UPCOMING_PAGE = {
  items: [
    {
      id: '01a1e936-40e7-7d25-a8df-d8c294fce4a8',
      title: 'Работа',
      description: null,
      start: '2026-11-23T08:00:00',
      end: '2026-11-23T17:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
      source: {
        templateEventId: '01a1e936-3e90-7524-8744-8863ef4f77a0',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:29.319822Z',
      updatedAt: '2026-11-17T11:13:29.319822Z',
      version: 0,
    },
    {
      id: '01a1e936-3d43-7d0b-b3e2-bf1906d5aa07',
      title: 'Работа',
      description: null,
      start: '2026-11-23T09:00:00',
      end: '2026-11-23T18:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
      source: null,
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:28.385082Z',
      updatedAt: '2026-11-17T11:13:28.385082Z',
      version: 0,
    },
  ],
  page: 0,
  size: 2,
  totalElements: 7,
  totalPages: 4,
  hasNext: true,
} satisfies PageResponse<EventResponse>;

/** T2: new template, never applied. */
export const TEMPLATE_CREATED = {
  id: '01a1e936-3e8c-77f0-b563-325f5b80ef19',
  name: 'Обычная неделя',
  description: null,
  events: [
    {
      id: '01a1e936-3e90-7524-8744-8863ef4f77a0',
      title: 'Работа',
      description: null,
      dayOfWeek: 'MONDAY',
      startTime: '08:00:00',
      durationMinutes: 540,
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
    },
    {
      id: '01a1e936-3e91-7ef5-ad6a-e3cb00fec5a6',
      title: 'Пробежка',
      description: 'Парк',
      dayOfWeek: 'TUESDAY',
      startTime: '07:00:00',
      durationMinutes: 60,
      participantIds: [
        '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
        '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      ],
      category: 'SPORT',
      color: null,
    },
    {
      id: '01a1e936-3e92-7785-aa2b-c42600cb1394',
      title: 'Сон',
      description: null,
      dayOfWeek: 'SUNDAY',
      startTime: '23:00:00',
      durationMinutes: 480,
      participantIds: ['01a1e936-3c7b-7aa9-a61b-e55f056e66c1'],
      category: 'SLEEP',
      color: 'REST',
    },
  ],
  lastApplication: null,
  createdAt: '2026-11-17T11:13:28.715947800Z',
  updatedAt: '2026-11-17T11:13:28.715947800Z',
  version: 0,
} satisfies TemplateResponse;

/** T3: the same template after MERGE and REPLACE. */
export const TEMPLATE_WITH_LAST_APPLICATION = {
  id: '01a1e936-3e8c-77f0-b563-325f5b80ef19',
  name: 'Обычная неделя',
  description: null,
  events: [
    {
      id: '01a1e936-3e90-7524-8744-8863ef4f77a0',
      title: 'Работа',
      description: null,
      dayOfWeek: 'MONDAY',
      startTime: '08:00:00',
      durationMinutes: 540,
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
    },
    {
      id: '01a1e936-3e91-7ef5-ad6a-e3cb00fec5a6',
      title: 'Пробежка',
      description: 'Парк',
      dayOfWeek: 'TUESDAY',
      startTime: '07:00:00',
      durationMinutes: 60,
      participantIds: [
        '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
        '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      ],
      category: 'SPORT',
      color: null,
    },
    {
      id: '01a1e936-3e92-7785-aa2b-c42600cb1394',
      title: 'Сон',
      description: null,
      dayOfWeek: 'SUNDAY',
      startTime: '23:00:00',
      durationMinutes: 480,
      participantIds: ['01a1e936-3c7b-7aa9-a61b-e55f056e66c1'],
      category: 'SLEEP',
      color: 'REST',
    },
  ],
  lastApplication: {
    id: '01a1e936-40e9-7956-8672-1644ecab0246',
    templateId: '01a1e936-3e8c-77f0-b563-325f5b80ef19',
    templateName: 'Обычная неделя',
    weekStart: '2026-11-23',
    mode: 'REPLACE',
    createdCount: 3,
    skippedCount: 0,
    deletedCount: 2,
    appliedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
    appliedAt: '2026-11-17T11:13:29.321045Z',
  },
  createdAt: '2026-11-17T11:13:28.715948Z',
  updatedAt: '2026-11-17T11:13:28.715948Z',
  version: 0,
} satisfies TemplateResponse;

/** T6 MERGE on a week with manual events: one conflict. */
export const APPLY_PREVIEW_MERGE = {
  weekStart: '2026-11-23',
  mode: 'MERGE',
  toCreate: [
    {
      templateEventId: '01a1e936-3e90-7524-8744-8863ef4f77a0',
      title: 'Работа',
      description: null,
      start: '2026-11-23T08:00:00',
      end: '2026-11-23T17:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
    },
    {
      templateEventId: '01a1e936-3e91-7ef5-ad6a-e3cb00fec5a6',
      title: 'Пробежка',
      description: 'Парк',
      start: '2026-11-24T07:00:00',
      end: '2026-11-24T08:00:00',
      participantIds: [
        '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
        '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      ],
      category: 'SPORT',
      color: null,
    },
    {
      templateEventId: '01a1e936-3e92-7785-aa2b-c42600cb1394',
      title: 'Сон',
      description: null,
      start: '2026-11-29T23:00:00',
      end: '2026-11-30T07:00:00',
      participantIds: ['01a1e936-3c7b-7aa9-a61b-e55f056e66c1'],
      category: 'SLEEP',
      color: 'REST',
    },
  ],
  skippedAlreadyApplied: [],
  skippedDeleted: [],
  skippedBusy: [],
  restoredDeleted: [],
  conflicts: [
    {
      planned: {
        templateEventId: '01a1e936-3e90-7524-8744-8863ef4f77a0',
        title: 'Работа',
        description: null,
        start: '2026-11-23T08:00:00',
        end: '2026-11-23T17:00:00',
        participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
        category: 'WORK',
        color: null,
      },
      existing: {
        id: '01a1e936-3d43-7d0b-b3e2-bf1906d5aa07',
        title: 'Работа',
        description: null,
        start: '2026-11-23T09:00:00',
        end: '2026-11-23T18:00:00',
        participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
        category: 'WORK',
        color: null,
        source: null,
        createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
        updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
        createdAt: '2026-11-17T11:13:28.385082Z',
        updatedAt: '2026-11-17T11:13:28.385082Z',
        version: 0,
      },
    },
  ],
  toDelete: [],
  manualEventsInWeek: 4,
} satisfies ApplyPreviewResponse;

/** T6 MERGE again after one occurrence was deleted: everything skipped. */
export const APPLY_PREVIEW_MERGE_AGAIN = {
  weekStart: '2026-11-23',
  mode: 'MERGE',
  toCreate: [],
  skippedAlreadyApplied: [
    {
      templateEventId: '01a1e936-3e90-7524-8744-8863ef4f77a0',
      title: 'Работа',
      description: null,
      start: '2026-11-23T08:00:00',
      end: '2026-11-23T17:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
    },
    {
      templateEventId: '01a1e936-3e92-7785-aa2b-c42600cb1394',
      title: 'Сон',
      description: null,
      start: '2026-11-29T23:00:00',
      end: '2026-11-30T07:00:00',
      participantIds: ['01a1e936-3c7b-7aa9-a61b-e55f056e66c1'],
      category: 'SLEEP',
      color: 'REST',
    },
  ],
  skippedDeleted: [
    {
      templateEventId: '01a1e936-3e91-7ef5-ad6a-e3cb00fec5a6',
      title: 'Пробежка',
      description: 'Парк',
      start: '2026-11-24T07:00:00',
      end: '2026-11-24T08:00:00',
      participantIds: [
        '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
        '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      ],
      category: 'SPORT',
      color: null,
    },
  ],
  skippedBusy: [],
  restoredDeleted: [],
  conflicts: [],
  toDelete: [],
  manualEventsInWeek: 4,
} satisfies ApplyPreviewResponse;

/** T6 REPLACE (includeManual: false): toDelete, restoredDeleted and conflicts are non-empty. */
export const APPLY_PREVIEW_REPLACE = {
  weekStart: '2026-11-23',
  mode: 'REPLACE',
  toCreate: [
    {
      templateEventId: '01a1e936-3e90-7524-8744-8863ef4f77a0',
      title: 'Работа',
      description: null,
      start: '2026-11-23T08:00:00',
      end: '2026-11-23T17:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
    },
    {
      templateEventId: '01a1e936-3e91-7ef5-ad6a-e3cb00fec5a6',
      title: 'Пробежка',
      description: 'Парк',
      start: '2026-11-24T07:00:00',
      end: '2026-11-24T08:00:00',
      participantIds: [
        '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
        '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      ],
      category: 'SPORT',
      color: null,
    },
    {
      templateEventId: '01a1e936-3e92-7785-aa2b-c42600cb1394',
      title: 'Сон',
      description: null,
      start: '2026-11-29T23:00:00',
      end: '2026-11-30T07:00:00',
      participantIds: ['01a1e936-3c7b-7aa9-a61b-e55f056e66c1'],
      category: 'SLEEP',
      color: 'REST',
    },
  ],
  skippedAlreadyApplied: [],
  skippedDeleted: [],
  skippedBusy: [],
  restoredDeleted: [
    {
      templateEventId: '01a1e936-3e91-7ef5-ad6a-e3cb00fec5a6',
      title: 'Пробежка',
      description: 'Парк',
      start: '2026-11-24T07:00:00',
      end: '2026-11-24T08:00:00',
      participantIds: [
        '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
        '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      ],
      category: 'SPORT',
      color: null,
    },
  ],
  conflicts: [
    {
      planned: {
        templateEventId: '01a1e936-3e90-7524-8744-8863ef4f77a0',
        title: 'Работа',
        description: null,
        start: '2026-11-23T08:00:00',
        end: '2026-11-23T17:00:00',
        participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
        category: 'WORK',
        color: null,
      },
      existing: {
        id: '01a1e936-3d43-7d0b-b3e2-bf1906d5aa07',
        title: 'Работа',
        description: null,
        start: '2026-11-23T09:00:00',
        end: '2026-11-23T18:00:00',
        participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
        category: 'WORK',
        color: null,
        source: null,
        createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
        updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
        createdAt: '2026-11-17T11:13:28.385082Z',
        updatedAt: '2026-11-17T11:13:28.385082Z',
        version: 0,
      },
    },
  ],
  toDelete: [
    {
      id: '01a1e936-3f89-77c1-bdaa-3daf61206798',
      title: 'Работа',
      description: null,
      start: '2026-11-23T08:00:00',
      end: '2026-11-23T17:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
      source: {
        templateEventId: '01a1e936-3e90-7524-8744-8863ef4f77a0',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:28.967816Z',
      updatedAt: '2026-11-17T11:13:28.967816Z',
      version: 0,
    },
    {
      id: '01a1e936-3f8b-7249-9933-56f14f00f1ce',
      title: 'Сон',
      description: null,
      start: '2026-11-29T23:00:00',
      end: '2026-11-30T07:00:00',
      participantIds: ['01a1e936-3c7b-7aa9-a61b-e55f056e66c1'],
      category: 'SLEEP',
      color: 'REST',
      source: {
        templateEventId: '01a1e936-3e92-7785-aa2b-c42600cb1394',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:28.967816Z',
      updatedAt: '2026-11-17T11:13:28.967816Z',
      version: 0,
    },
  ],
  manualEventsInWeek: 4,
} satisfies ApplyPreviewResponse;

/** T7 MERGE. */
export const APPLY_RESULT_MERGE = {
  application: {
    id: '01a1e936-3f8c-7408-bd60-06f60bd0d9b7',
    templateId: '01a1e936-3e8c-77f0-b563-325f5b80ef19',
    templateName: 'Обычная неделя',
    weekStart: '2026-11-23',
    mode: 'MERGE',
    createdCount: 3,
    skippedCount: 0,
    deletedCount: 0,
    appliedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
    appliedAt: '2026-11-17T11:13:28.971711300Z',
  },
  createdEvents: [
    {
      id: '01a1e936-3f89-77c1-bdaa-3daf61206798',
      title: 'Работа',
      description: null,
      start: '2026-11-23T08:00:00',
      end: '2026-11-23T17:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
      source: {
        templateEventId: '01a1e936-3e90-7524-8744-8863ef4f77a0',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:28.967815900Z',
      updatedAt: '2026-11-17T11:13:28.967815900Z',
      version: 0,
    },
    {
      id: '01a1e936-3f8a-79b3-b506-c13c8ee4b37e',
      title: 'Пробежка',
      description: 'Парк',
      start: '2026-11-24T07:00:00',
      end: '2026-11-24T08:00:00',
      participantIds: [
        '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
        '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      ],
      category: 'SPORT',
      color: null,
      source: {
        templateEventId: '01a1e936-3e91-7ef5-ad6a-e3cb00fec5a6',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:28.967815900Z',
      updatedAt: '2026-11-17T11:13:28.967815900Z',
      version: 0,
    },
    {
      id: '01a1e936-3f8b-7249-9933-56f14f00f1ce',
      title: 'Сон',
      description: null,
      start: '2026-11-29T23:00:00',
      end: '2026-11-30T07:00:00',
      participantIds: ['01a1e936-3c7b-7aa9-a61b-e55f056e66c1'],
      category: 'SLEEP',
      color: 'REST',
      source: {
        templateEventId: '01a1e936-3e92-7785-aa2b-c42600cb1394',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:28.967815900Z',
      updatedAt: '2026-11-17T11:13:28.967815900Z',
      version: 0,
    },
  ],
} satisfies ApplyResultResponse;

/** T7 REPLACE with the confirmed sets taken from APPLY_PREVIEW_REPLACE. */
export const APPLY_RESULT_REPLACE = {
  application: {
    id: '01a1e936-40e9-7956-8672-1644ecab0246',
    templateId: '01a1e936-3e8c-77f0-b563-325f5b80ef19',
    templateName: 'Обычная неделя',
    weekStart: '2026-11-23',
    mode: 'REPLACE',
    createdCount: 3,
    skippedCount: 0,
    deletedCount: 2,
    appliedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
    appliedAt: '2026-11-17T11:13:29.321045300Z',
  },
  createdEvents: [
    {
      id: '01a1e936-40e7-7d25-a8df-d8c294fce4a8',
      title: 'Работа',
      description: null,
      start: '2026-11-23T08:00:00',
      end: '2026-11-23T17:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
      source: {
        templateEventId: '01a1e936-3e90-7524-8744-8863ef4f77a0',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:29.319821600Z',
      updatedAt: '2026-11-17T11:13:29.319821600Z',
      version: 0,
    },
    {
      id: '01a1e936-40e8-7657-a03b-05664f90894c',
      title: 'Пробежка',
      description: 'Парк',
      start: '2026-11-24T07:00:00',
      end: '2026-11-24T08:00:00',
      participantIds: [
        '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
        '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      ],
      category: 'SPORT',
      color: null,
      source: {
        templateEventId: '01a1e936-3e91-7ef5-ad6a-e3cb00fec5a6',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:29.319821600Z',
      updatedAt: '2026-11-17T11:13:29.319821600Z',
      version: 0,
    },
    {
      id: '01a1e936-40e9-70b9-9d05-2433d5c0a5b2',
      title: 'Сон',
      description: null,
      start: '2026-11-29T23:00:00',
      end: '2026-11-30T07:00:00',
      participantIds: ['01a1e936-3c7b-7aa9-a61b-e55f056e66c1'],
      category: 'SLEEP',
      color: 'REST',
      source: {
        templateEventId: '01a1e936-3e92-7785-aa2b-c42600cb1394',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:29.319821600Z',
      updatedAt: '2026-11-17T11:13:29.319821600Z',
      version: 0,
    },
  ],
} satisfies ApplyResultResponse;

/** S1: the week after REPLACE (template still exists). */
export const WEEK = {
  weekStart: '2026-11-23',
  weekEnd: '2026-11-29',
  timeZone: 'Asia/Almaty',
  members: [
    {
      userId: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      displayName: 'Даулет',
      role: 'OWNER',
      seat: 1,
      joinedAt: '2026-11-17T11:13:28.222536Z',
    },
    {
      userId: '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
      displayName: 'Айгерим',
      role: 'MEMBER',
      seat: 2,
      joinedAt: '2026-11-17T11:13:28.275059Z',
    },
  ],
  events: [
    {
      id: '01a1e936-40e7-7d25-a8df-d8c294fce4a8',
      title: 'Работа',
      description: null,
      start: '2026-11-23T08:00:00',
      end: '2026-11-23T17:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
      source: {
        templateEventId: '01a1e936-3e90-7524-8744-8863ef4f77a0',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:29.319822Z',
      updatedAt: '2026-11-17T11:13:29.319822Z',
      version: 0,
    },
    {
      id: '01a1e936-3d43-7d0b-b3e2-bf1906d5aa07',
      title: 'Работа',
      description: null,
      start: '2026-11-23T09:00:00',
      end: '2026-11-23T18:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
      source: null,
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:28.385082Z',
      updatedAt: '2026-11-17T11:13:28.385082Z',
      version: 0,
    },
    {
      id: '01a1e936-40e8-7657-a03b-05664f90894c',
      title: 'Пробежка',
      description: 'Парк',
      start: '2026-11-24T07:00:00',
      end: '2026-11-24T08:00:00',
      participantIds: [
        '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
        '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      ],
      category: 'SPORT',
      color: null,
      source: {
        templateEventId: '01a1e936-3e91-7ef5-ad6a-e3cb00fec5a6',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:29.319822Z',
      updatedAt: '2026-11-17T11:13:29.319822Z',
      version: 0,
    },
    {
      id: '01a1e936-3db8-71b3-ae71-593e8f97b638',
      title: 'Ужин вместе',
      description: 'Столик на 19:30',
      start: '2026-11-25T19:00:00',
      end: '2026-11-25T21:00:00',
      participantIds: [
        '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
        '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      ],
      category: 'TOGETHER',
      color: 'FOOD',
      source: null,
      createdBy: '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
      updatedBy: '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
      createdAt: '2026-11-17T11:13:28.504106Z',
      updatedAt: '2026-11-17T11:13:28.504106Z',
      version: 0,
    },
    {
      id: '01a1e936-3dd4-7e58-a79b-5db7fa326c7d',
      title: 'Сон',
      description: null,
      start: '2026-11-28T23:30:00',
      end: '2026-11-29T07:30:00',
      participantIds: ['01a1e936-3c7b-7aa9-a61b-e55f056e66c1'],
      category: 'SLEEP',
      color: null,
      source: null,
      createdBy: '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
      updatedBy: '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
      createdAt: '2026-11-17T11:13:28.532390Z',
      updatedAt: '2026-11-17T11:13:28.532390Z',
      version: 0,
    },
    {
      id: '01a1e936-3dee-7f8e-963e-3fcb9658277e',
      title: 'Поезд',
      description: null,
      start: '2026-11-29T22:00:00',
      end: '2026-11-30T06:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'TRIP',
      color: null,
      source: null,
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:28.558972Z',
      updatedAt: '2026-11-17T11:13:28.558972Z',
      version: 0,
    },
    {
      id: '01a1e936-40e9-70b9-9d05-2433d5c0a5b2',
      title: 'Сон',
      description: null,
      start: '2026-11-29T23:00:00',
      end: '2026-11-30T07:00:00',
      participantIds: ['01a1e936-3c7b-7aa9-a61b-e55f056e66c1'],
      category: 'SLEEP',
      color: 'REST',
      source: {
        templateEventId: '01a1e936-3e92-7785-aa2b-c42600cb1394',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:29.319822Z',
      updatedAt: '2026-11-17T11:13:29.319822Z',
      version: 0,
    },
  ],
  appliedTemplates: [
    {
      id: '01a1e936-3f8c-7408-bd60-06f60bd0d9b7',
      templateId: '01a1e936-3e8c-77f0-b563-325f5b80ef19',
      templateName: 'Обычная неделя',
      weekStart: '2026-11-23',
      mode: 'MERGE',
      createdCount: 3,
      skippedCount: 0,
      deletedCount: 0,
      appliedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      appliedAt: '2026-11-17T11:13:28.971711Z',
    },
    {
      id: '01a1e936-40e9-7956-8672-1644ecab0246',
      templateId: '01a1e936-3e8c-77f0-b563-325f5b80ef19',
      templateName: 'Обычная неделя',
      weekStart: '2026-11-23',
      mode: 'REPLACE',
      createdCount: 3,
      skippedCount: 0,
      deletedCount: 2,
      appliedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      appliedAt: '2026-11-17T11:13:29.321045Z',
    },
  ],
} satisfies WeekResponse;

/** S1: the same week after the template was deleted — templateId: null, source kept. */
export const WEEK_TEMPLATE_DELETED = {
  weekStart: '2026-11-23',
  weekEnd: '2026-11-29',
  timeZone: 'Asia/Almaty',
  members: [
    {
      userId: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      displayName: 'Даулет',
      role: 'OWNER',
      seat: 1,
      joinedAt: '2026-11-17T11:13:28.222536Z',
    },
    {
      userId: '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
      displayName: 'Айгерим',
      role: 'MEMBER',
      seat: 2,
      joinedAt: '2026-11-17T11:13:28.275059Z',
    },
  ],
  events: [
    {
      id: '01a1e936-40e7-7d25-a8df-d8c294fce4a8',
      title: 'Работа',
      description: null,
      start: '2026-11-23T08:00:00',
      end: '2026-11-23T17:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
      source: {
        templateEventId: '01a1e936-3e90-7524-8744-8863ef4f77a0',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:29.319822Z',
      updatedAt: '2026-11-17T11:13:29.319822Z',
      version: 0,
    },
    {
      id: '01a1e936-3d43-7d0b-b3e2-bf1906d5aa07',
      title: 'Работа (офис)',
      description: null,
      start: '2026-11-23T09:00:00',
      end: '2026-11-23T17:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'WORK',
      color: null,
      source: null,
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:28.385082Z',
      updatedAt: '2026-11-17T11:13:29.695642Z',
      version: 1,
    },
    {
      id: '01a1e936-40e8-7657-a03b-05664f90894c',
      title: 'Пробежка',
      description: 'Парк',
      start: '2026-11-24T07:00:00',
      end: '2026-11-24T08:00:00',
      participantIds: [
        '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
        '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      ],
      category: 'SPORT',
      color: null,
      source: {
        templateEventId: '01a1e936-3e91-7ef5-ad6a-e3cb00fec5a6',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:29.319822Z',
      updatedAt: '2026-11-17T11:13:29.319822Z',
      version: 0,
    },
    {
      id: '01a1e936-3db8-71b3-ae71-593e8f97b638',
      title: 'Ужин вместе',
      description: 'Столик на 19:30',
      start: '2026-11-25T19:00:00',
      end: '2026-11-25T21:00:00',
      participantIds: [
        '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
        '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      ],
      category: 'TOGETHER',
      color: 'FOOD',
      source: null,
      createdBy: '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
      updatedBy: '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
      createdAt: '2026-11-17T11:13:28.504106Z',
      updatedAt: '2026-11-17T11:13:28.504106Z',
      version: 0,
    },
    {
      id: '01a1e936-3dd4-7e58-a79b-5db7fa326c7d',
      title: 'Сон',
      description: null,
      start: '2026-11-28T23:30:00',
      end: '2026-11-29T07:30:00',
      participantIds: ['01a1e936-3c7b-7aa9-a61b-e55f056e66c1'],
      category: 'SLEEP',
      color: null,
      source: null,
      createdBy: '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
      updatedBy: '01a1e936-3c7b-7aa9-a61b-e55f056e66c1',
      createdAt: '2026-11-17T11:13:28.532390Z',
      updatedAt: '2026-11-17T11:13:28.532390Z',
      version: 0,
    },
    {
      id: '01a1e936-3dee-7f8e-963e-3fcb9658277e',
      title: 'Поезд',
      description: null,
      start: '2026-11-29T22:00:00',
      end: '2026-11-30T06:00:00',
      participantIds: ['01a1e936-3bd3-7526-92bc-ffdf1d6c86a0'],
      category: 'TRIP',
      color: null,
      source: null,
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:28.558972Z',
      updatedAt: '2026-11-17T11:13:28.558972Z',
      version: 0,
    },
    {
      id: '01a1e936-40e9-70b9-9d05-2433d5c0a5b2',
      title: 'Сон',
      description: null,
      start: '2026-11-29T23:00:00',
      end: '2026-11-30T07:00:00',
      participantIds: ['01a1e936-3c7b-7aa9-a61b-e55f056e66c1'],
      category: 'SLEEP',
      color: 'REST',
      source: {
        templateEventId: '01a1e936-3e92-7785-aa2b-c42600cb1394',
        weekStart: '2026-11-23',
        templateName: 'Обычная неделя',
      },
      createdBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      updatedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      createdAt: '2026-11-17T11:13:29.319822Z',
      updatedAt: '2026-11-17T11:13:29.319822Z',
      version: 0,
    },
  ],
  appliedTemplates: [
    {
      id: '01a1e936-3f8c-7408-bd60-06f60bd0d9b7',
      templateId: null,
      templateName: 'Обычная неделя',
      weekStart: '2026-11-23',
      mode: 'MERGE',
      createdCount: 3,
      skippedCount: 0,
      deletedCount: 0,
      appliedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      appliedAt: '2026-11-17T11:13:28.971711Z',
    },
    {
      id: '01a1e936-40e9-7956-8672-1644ecab0246',
      templateId: null,
      templateName: 'Обычная неделя',
      weekStart: '2026-11-23',
      mode: 'REPLACE',
      createdCount: 3,
      skippedCount: 0,
      deletedCount: 2,
      appliedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      appliedAt: '2026-11-17T11:13:29.321045Z',
    },
  ],
} satisfies WeekResponse;

/** T8: history, page of size 1 after the template was deleted. */
export const TEMPLATE_APPLICATIONS_PAGE = {
  items: [
    {
      id: '01a1e936-40e9-7956-8672-1644ecab0246',
      templateId: null,
      templateName: 'Обычная неделя',
      weekStart: '2026-11-23',
      mode: 'REPLACE',
      createdCount: 3,
      skippedCount: 0,
      deletedCount: 2,
      appliedBy: '01a1e936-3bd3-7526-92bc-ffdf1d6c86a0',
      appliedAt: '2026-11-17T11:13:29.321045Z',
    },
  ],
  page: 0,
  size: 1,
  totalElements: 2,
  totalPages: 2,
  hasNext: true,
} satisfies PageResponse<TemplateApplicationResponse>;
