import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { PageResponse } from '@core/api/models/common.models';
import {
  AUTH_RESPONSE,
  TEMPLATE_APPLICATIONS_PAGE,
  WEEK,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import type { TemplateApplicationResponse } from '@core/api/models/template.models';
import type { WorkspaceResponse } from '@core/api/models/workspace.models';
import { SessionStore } from '@core/auth/session-store';
import { DataChanges } from '@core/changes/data-changes';
import { errorInterceptor } from '@core/error/error-interceptor';
import { HistoryList } from './history-list';

const WS = WORKSPACE_FULL_PAIR.id;
const url = (page: number) => (r: { url: string; params: { get(k: string): string | null } }) =>
  r.url === `/api/v1/workspaces/${WS}/template-applications` &&
  r.params.get('page') === String(page) &&
  r.params.get('size') === '20';
const [FIRST] = WEEK.members;
const line = (n: number, patch: Partial<TemplateApplicationResponse> = {}) => ({
  ...TEMPLATE_APPLICATIONS_PAGE.items[0],
  id: `app-${n}`,
  appliedBy: FIRST.userId,
  ...patch,
});
const page = (
  items: TemplateApplicationResponse[],
  n: number,
  hasNext: boolean,
): PageResponse<TemplateApplicationResponse> => ({
  items,
  page: n,
  size: 20,
  totalElements: items.length,
  totalPages: hasNext ? n + 2 : n + 1,
  hasNext,
});

describe('tp-history-list (TPL-10)', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<HistoryList>;
  const host = () => fixture.nativeElement as HTMLElement;
  const lines = () =>
    Array.from(host().querySelectorAll('li')).map((li) => ({
      text: li.querySelector('.text')?.textContent,
      meta: li.querySelector('.meta')?.textContent,
    }));
  const more = () =>
    Array.from(host().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Показать ещё'),
    ) as HTMLButtonElement | undefined;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace({
      ...WORKSPACE_FULL_PAIR,
      members: WEEK.members,
    } as unknown as WorkspaceResponse);
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HistoryList);
    fixture.detectChanges();
  });

  afterEach(() => backend.verify());

  it('shows a spinner, then a line: name of that moment, week, mode, counters, who and when', async () => {
    expect(host().querySelector('tp-spinner')).not.toBeNull();
    backend.expectOne(url(0)).flush(page([line(1)], 0, false));
    await fixture.whenStable();
    expect(lines()).toEqual([
      {
        text: '«Обычная неделя» → неделя 23–29 нояб.',
        meta: `Заменить · создано 3, удалено 2 · ${FIRST.displayName}, 17 ноября, ${'16:13'}`,
      },
    ]);
    expect(more()).toBeUndefined();
  });

  it('skipped is said only when there are some; an unknown author is «Участник»', async () => {
    backend
      .expectOne(url(0))
      .flush(
        page(
          [line(1, { mode: 'MERGE', skippedCount: 4, deletedCount: 0, appliedBy: 'gone' })],
          0,
          false,
        ),
      );
    await fixture.whenStable();
    expect(lines()[0].meta).toContain('создано 3, пропущено 4 · Участник,');
    expect(lines()[0].meta).not.toContain('удалено');
  });

  it('an empty journal says so', async () => {
    backend.expectOne(url(0)).flush(page([], 0, false));
    await fixture.whenStable();
    expect(host().textContent).toContain('Шаблоны ещё не применяли');
  });

  it('«Показать ещё» asks the next page and adds its lines below, until hasNext is false', async () => {
    backend.expectOne(url(0)).flush(page([line(1)], 0, true));
    await fixture.whenStable();
    more()!.click();
    backend.expectOne(url(1)).flush(page([line(2), line(3)], 1, false));
    await fixture.whenStable();
    expect(lines()).toHaveLength(3);
    expect(more()).toBeUndefined();
  });

  it('a failed «ещё» keeps the lines and says why; a failed first page shows the error', async () => {
    backend.expectOne(url(0)).flush(page([line(1)], 0, true));
    await fixture.whenStable();
    more()!.click();
    backend.expectOne(url(1)).flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(lines()).toHaveLength(1);
    expect(host().querySelector('[role="alert"]')).not.toBeNull();
    expect(more()).toBeDefined();

    TestBed.inject(DataChanges).templatesChanged();
    backend.expectOne(url(0)).flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(host().querySelector('tp-error-state')).not.toBeNull();
  });

  it('an application elsewhere (templatesChanged) brings a fresh first page', async () => {
    backend.expectOne(url(0)).flush(page([line(1)], 0, false));
    await fixture.whenStable();
    TestBed.inject(DataChanges).templatesChanged();
    backend.expectOne(url(0)).flush(page([line(9), line(1)], 0, false));
    await fixture.whenStable();
    expect(lines()).toHaveLength(2);
  });
});
