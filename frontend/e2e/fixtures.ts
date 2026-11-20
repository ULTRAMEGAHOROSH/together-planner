// Fixtures for E2E with the backend (QA-01). A spec asks for what it needs and gets its own
// data: `couple` — two users in one workspace. Specs do not share data and do not clean it.
import { test as base } from '@playwright/test';
import type { WorkspaceResponse } from '../src/app/core/api/models/workspace.models';
import { createInvite, createWorkspace, join, registerUser, type TestUser } from './helpers/api';

export interface Couple {
  /** The creator of the workspace (seat 1). */
  readonly a: TestUser;
  /** The one who joined by the code (seat 2). */
  readonly b: TestUser;
  /** The workspace as seen after both are in it. */
  readonly workspace: WorkspaceResponse;
}

export const test = base.extend<{ couple: Couple }>({
  couple: async ({ request }, use) => {
    const a = await registerUser(request, 'Дана');
    const b = await registerUser(request, 'Ильяс');
    const created = await createWorkspace(request, a);
    const invite = await createInvite(request, a, created.id);
    const workspace = await join(request, b, invite.code);
    await use({ a, b, workspace });
  },
});

export { expect } from '@playwright/test';
