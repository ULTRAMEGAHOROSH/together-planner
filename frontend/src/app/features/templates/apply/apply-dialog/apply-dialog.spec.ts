import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Dialog } from '@angular/cdk/dialog';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AUTH_RESPONSE,
  TEMPLATE_CREATED,
  TEMPLATE_WITH_LAST_APPLICATION,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { errorInterceptor } from '@core/error/error-interceptor';
import { CLOCK } from '@core/time/zone-clock';
import { APPLY_PREVIEW_MERGE } from '@core/api/models/testing/samples';
import { isMonday } from '@shared/time';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { dialogElement, pressEscape, provideVisibleElements } from '@shared/ui/dialog/testing';
import { ApplyTemplateDialog, openApplyTemplate } from './apply-dialog';

const LIST = `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}/templates`;
// Thursday 19.11.2026 in Almaty: the current week starts on 16.11.
const NOW = Date.UTC(2026, 10, 19, 9, 20);
const SECOND = { ...TEMPLATE_WITH_LAST_APPLICATION, id: 'second-id', name: 'Отпуск' };

describe('ApplyTemplateDialog (TPL-05)', () => {
  let appRef: ApplicationRef;
  let backend: HttpTestingController;
  let closed: unknown[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideVisibleElements(),
        { provide: CLOCK, useValue: () => NOW },
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    appRef = TestBed.inject(ApplicationRef);
    backend = TestBed.inject(HttpTestingController);
    closed = [];
  });

  afterEach(() => {
    // The preview asks after a pause: a test that ends sooner leaves it unanswered.
    backend.match((r) => r.url.endsWith('/apply/preview'));
    backend.verify();
  });

  const root = () => dialogElement() as HTMLElement;
  const radios = (group: string) =>
    Array.from(root().querySelectorAll<HTMLButtonElement>(`${group} [role="radio"]`));
  const checked = (group: string) =>
    radios(group).findIndex((b) => b.getAttribute('aria-checked') === 'true');
  const button = (label: string) =>
    root().querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const manual = () => root().querySelector('.manual input') as HTMLInputElement | null;
  const weekText = () => root().querySelector('.week-text b')?.textContent;

  async function open(
    data: { templateId?: string; weekStart: string },
    templates: unknown[] = [TEMPLATE_CREATED, SECOND],
  ) {
    openApplyTemplate(TestBed.inject(DialogService), data).subscribe((r) => closed.push(r));
    await appRef.whenStable();
    backend.expectOne(LIST).flush(templates);
    await appRef.whenStable();
    return dialogComponent();
  }

  /** The dialog instance, to read its choice (the preview of TPL-06 builds on it). */
  function dialogComponent(): ApplyTemplateDialog {
    return TestBed.inject(Dialog).openDialogs[0].componentInstance as ApplyTemplateDialog;
  }

  it('shows the templates of T1, the week, the three modes; the first template is chosen', async () => {
    await open({ weekStart: '2026-11-23' });
    expect(root().querySelector('h2')?.textContent?.trim()).toBe('Применить шаблон');
    expect(radios('.options').map((b) => b.querySelector('.name')?.textContent)).toEqual([
      'Обычная неделя',
      'Отпуск',
    ]);
    expect(radios('.options')[0].querySelector('.meta')?.textContent).toBe('3 события');
    expect(checked('.options')).toBe(0);
    expect(weekText()).toBe('23–29 нояб.');
    expect(root().querySelector('.week .sub')?.textContent).toBe('Следующая неделя');
    expect(radios('.modes')).toHaveLength(3);
    expect(checked('.modes')).toBe(0);
  });

  it('starts with the template asked for', async () => {
    await open({ templateId: 'second-id', weekStart: '2026-11-23' });
    expect(checked('.options')).toBe(1);
  });

  it('a template that is not in the list falls back to the first', async () => {
    await open({ templateId: 'deleted-id', weekStart: '2026-11-23' });
    expect(checked('.options')).toBe(0);
  });

  it('picking another template moves the choice', async () => {
    await open({ weekStart: '2026-11-23' });
    radios('.options')[1].click();
    await appRef.whenStable();
    expect(checked('.options')).toBe(1);
  });

  it('the week is always a Monday: a date inside a week is moved, and the arrows step by weeks', async () => {
    await open({ weekStart: '2026-11-25' });
    expect(weekText()).toBe('23–29 нояб.');
    button('Следующая неделя').click();
    await appRef.whenStable();
    expect(weekText()).toBe('30 нояб. – 6 дек.');
    button('Предыдущая неделя').click();
    button('Предыдущая неделя').click();
    button('Предыдущая неделя').click();
    await appRef.whenStable();
    expect(weekText()).toBe('9–15 нояб.');
    expect(root().querySelector('.week .sub')?.textContent).toBe('Прошлая неделя');
  });

  it('«Удалить также созданные вручную» is shown only for «Заменить»', async () => {
    await open({ weekStart: '2026-11-23' });
    expect(manual()).toBeNull();
    radios('.modes')[1].click();
    await appRef.whenStable();
    expect(manual()).toBeNull();
    radios('.modes')[2].click();
    await appRef.whenStable();
    expect(manual()).not.toBeNull();
    expect(manual()!.checked).toBe(false);
  });

  it('leaving «Заменить» takes the tick back, so it cannot ride along into another mode', async () => {
    await open({ weekStart: '2026-11-23' });
    radios('.modes')[2].click();
    await appRef.whenStable();
    manual()!.click();
    await appRef.whenStable();
    radios('.modes')[0].click();
    await appRef.whenStable();
    radios('.modes')[2].click();
    await appRef.whenStable();
    expect(manual()!.checked).toBe(false);
  });

  it('exposes the choice as the T6 request: a Monday, includeManual only for REPLACE', async () => {
    const dialog = await open({ templateId: 'second-id', weekStart: '2026-11-25' });
    expect(dialog.params()).toEqual({
      templateId: 'second-id',
      weekStart: '2026-11-23',
      mode: 'MERGE',
      includeManual: false,
    });
    expect(isMonday(dialog.request().weekStart)).toBe(true);
  });

  it('«Отмена» and Esc close it without a result', async () => {
    await open({ weekStart: '2026-11-23' });
    (
      Array.from(root().querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Отмена',
      ) as HTMLButtonElement
    ).click();
    await appRef.whenStable();
    expect(closed).toEqual([undefined]);
    expect(dialogElement()).toBeNull();
  });

  it('Esc closes it', async () => {
    await open({ weekStart: '2026-11-23' });
    pressEscape();
    await appRef.whenStable();
    expect(dialogElement()).toBeNull();
  });

  it('shows a spinner while T1 loads', async () => {
    openApplyTemplate(TestBed.inject(DialogService), { weekStart: '2026-11-23' }).subscribe();
    await appRef.whenStable();
    expect(root().querySelector('tp-spinner')).not.toBeNull();
    backend.expectOne(LIST).flush([]);
    await appRef.whenStable();
  });

  it('no templates: says so', async () => {
    await open({ weekStart: '2026-11-23' }, []);
    expect(root().querySelector('.empty')?.textContent).toContain('Шаблонов пока нет');
  });

  it('a failed T1 shows the error with «Повторить»', async () => {
    openApplyTemplate(TestBed.inject(DialogService), { weekStart: '2026-11-23' }).subscribe();
    await appRef.whenStable();
    backend
      .expectOne(LIST)
      .flush(
        { type: 'about:blank', title: 'x', status: 500, code: 'INTERNAL_ERROR' },
        { status: 500, statusText: 'x' },
      );
    await appRef.whenStable();
    root().querySelector<HTMLButtonElement>('tp-error-state button')!.click();
    backend.expectOne(LIST).flush([TEMPLATE_CREATED]);
    await appRef.whenStable();
    expect(radios('.options')).toHaveLength(1);
  });

  describe('preview (TPL-06)', () => {
    const PREVIEW = (id: string) => `${LIST}/${id}/apply/preview`;
    const pause = () => new Promise((resolve) => setTimeout(resolve, 220));

    it('asks T6 for the choice on screen and shows the plan in the dialog', async () => {
      await open({ weekStart: '2026-11-25' });
      await pause();
      const req = backend.expectOne(PREVIEW(TEMPLATE_CREATED.id));
      expect(req.request.body).toEqual({
        weekStart: '2026-11-23',
        mode: 'MERGE',
        includeManual: false,
        confirmedDeleteIds: null,
        confirmedRestoredIds: null,
      });
      req.flush(APPLY_PREVIEW_MERGE);
      await appRef.whenStable();
      expect(root().querySelector('.banner')?.textContent).toContain('ничего ещё не сохранено');
      expect(root().querySelector('.stat .value')?.textContent).toBe('+3');
    });

    it('a change of mode, week or template asks again; a burst makes one request', async () => {
      await open({ weekStart: '2026-11-23' });
      await pause();
      backend.expectOne(PREVIEW(TEMPLATE_CREATED.id)).flush(APPLY_PREVIEW_MERGE);
      radios('.modes')[1].click();
      button('Следующая неделя').click();
      radios('.options')[1].click();
      await appRef.whenStable();
      await pause();
      const req = backend.expectOne(PREVIEW('second-id'));
      expect(req.request.body).toMatchObject({ weekStart: '2026-11-30', mode: 'FILL' });
      req.flush({ ...APPLY_PREVIEW_MERGE, mode: 'FILL' });
    });

    it('«Заменить» with the tick asks with includeManual, and the tick shows the count of the plan', async () => {
      await open({ weekStart: '2026-11-23' });
      await pause();
      backend.expectOne(PREVIEW(TEMPLATE_CREATED.id)).flush(APPLY_PREVIEW_MERGE);
      await appRef.whenStable();
      radios('.modes')[2].click();
      await appRef.whenStable();
      manual()!.click();
      await appRef.whenStable();
      await pause();
      const req = backend.expectOne(PREVIEW(TEMPLATE_CREATED.id));
      expect(req.request.body).toMatchObject({ mode: 'REPLACE', includeManual: true });
      req.flush({ ...APPLY_PREVIEW_MERGE, mode: 'REPLACE' });
      await appRef.whenStable();
      expect(root().querySelector('.manual span')?.textContent?.replace(/\s+/g, ' ')).toContain(
        '(4)',
      );
    });

    it('AP-06: a failed T6 shows its message inside the dialog', async () => {
      await open({ weekStart: '2026-11-23' });
      await pause();
      backend
        .expectOne(PREVIEW(TEMPLATE_CREATED.id))
        .flush(
          { type: 'about:blank', title: 'x', status: 404, code: 'TEMPLATE_NOT_FOUND' },
          { status: 404, statusText: 'Not Found' },
        );
      await appRef.whenStable();
      expect(root().querySelector('tp-apply-preview .error')?.textContent).toBe(
        'Уже удалено партнёром.',
      );
    });

    it('no templates: no request', async () => {
      await open({ weekStart: '2026-11-23' }, []);
      await pause();
      backend.expectNone(() => true);
    });
  });
});
