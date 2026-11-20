import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Dialog } from '@angular/cdk/dialog';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  AUTH_RESPONSE,
  TEMPLATE_CREATED,
  TEMPLATE_WITH_LAST_APPLICATION,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { errorInterceptor } from '@core/error/error-interceptor';
import { CLOCK } from '@core/time/zone-clock';
import {
  APPLY_PREVIEW_MERGE,
  APPLY_PREVIEW_MERGE_AGAIN,
  APPLY_PREVIEW_REPLACE,
  APPLY_RESULT_MERGE,
  APPLY_RESULT_REPLACE,
} from '@core/api/models/testing/samples';
import { DataChanges } from '@core/changes/data-changes';
import { ToastService } from '@core/notify/toast-service';
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
        provideRouter([]),
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
    // After an application the open dialog's own list reloads (templatesChanged) once.
    backend.match((r) => r.method === 'GET' && r.url === LIST);
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

  describe('apply (TPL-07)', () => {
    const PREVIEW = (id: string) => `${LIST}/${id}/apply/preview`;
    const APPLY = (id: string) => `${LIST}/${id}/apply`;
    const pause = () => new Promise((resolve) => setTimeout(resolve, 220));
    const footer = (label: string) =>
      Array.from(root().querySelectorAll<HTMLButtonElement>('.foot button, footer button')).find(
        (b) => b.textContent?.trim().startsWith(label),
      );

    /** Opens, picks the mode and waits until the plan is on screen. */
    async function ready(preview: object, modeIndex = 0) {
      await open({ weekStart: '2026-11-23' });
      await pause();
      if (modeIndex === 0) {
        backend.expectOne(PREVIEW(TEMPLATE_CREATED.id)).flush(preview);
      } else {
        backend.expectOne(PREVIEW(TEMPLATE_CREATED.id)).flush(APPLY_PREVIEW_MERGE);
        radios('.modes')[modeIndex].click();
        await appRef.whenStable();
        await pause();
        backend.expectOne(PREVIEW(TEMPLATE_CREATED.id)).flush(preview);
      }
      await appRef.whenStable();
    }

    it('AP-08/AP-10: MERGE sends no confirmed sets; a success toasts, goes to the week, tells everyone and closes', async () => {
      const toast = vi.spyOn(TestBed.inject(ToastService), 'show');
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      const events = vi.fn();
      const templates = vi.fn();
      TestBed.inject(DataChanges).events$.subscribe(events);
      TestBed.inject(DataChanges).templates$.subscribe(templates);
      await ready(APPLY_PREVIEW_MERGE);
      expect(footer('Применить')?.textContent?.trim()).toBe('Применить: +3');
      footer('Применить')!.click();
      const req = backend.expectOne(APPLY(TEMPLATE_CREATED.id));
      expect(req.request.body).toEqual({
        weekStart: '2026-11-23',
        mode: 'MERGE',
        includeManual: false,
        confirmedDeleteIds: null,
        confirmedRestoredIds: null,
      });
      req.flush(APPLY_RESULT_MERGE);
      await appRef.whenStable();
      expect(toast).toHaveBeenCalledWith('«Обычная неделя» → 23–29 нояб.: добавлено 3');
      expect(navigate).toHaveBeenCalledWith('/week/2026-11-23');
      expect(events).toHaveBeenCalledTimes(1);
      expect(templates).toHaveBeenCalledTimes(1);
      expect(dialogElement()).toBeNull();
    });

    it('nothing to add and nothing to delete: «Применить» is not available', async () => {
      await ready(APPLY_PREVIEW_MERGE_AGAIN);
      expect(footer('Применить')!.disabled).toBe(true);
      footer('Применить')!.click();
      backend.expectNone(APPLY(TEMPLATE_CREATED.id));
    });

    it('while the next plan loads there is nothing to apply, not even the old plan', async () => {
      await ready(APPLY_PREVIEW_MERGE);
      expect(footer('Применить')!.disabled).toBe(false);
      radios('.modes')[1].click();
      await appRef.whenStable();
      expect(footer('Применить')!.disabled).toBe(true);
      await pause();
      backend
        .expectOne(PREVIEW(TEMPLATE_CREATED.id))
        .flush({ ...APPLY_PREVIEW_MERGE, mode: 'FILL' });
    });

    it('AP-03/AP-07: «Заменить» asks first with the lists; the confirmation sends exactly their ids', async () => {
      await ready(APPLY_PREVIEW_REPLACE, 2);
      const deletes = APPLY_PREVIEW_REPLACE.toDelete;
      const restored = APPLY_PREVIEW_REPLACE.restoredDeleted;
      expect(footer('Заменить')?.textContent?.trim()).toBe(
        `Заменить: −${deletes.length} / +${APPLY_PREVIEW_REPLACE.toCreate.length}`,
      );
      footer('Заменить')!.click();
      await appRef.whenStable();
      backend.expectNone(APPLY(TEMPLATE_CREATED.id));
      const confirm = root().querySelector('.confirm')!;
      expect(confirm.textContent).toContain(`Будет удалено: ${deletes.length}`);
      expect(confirm.textContent).toContain(`Будет восстановлено: ${restored.length}`);
      expect(confirm.querySelectorAll('li')).toHaveLength(deletes.length + restored.length);

      footer('Заменить')!.click();
      const req = backend.expectOne(APPLY(TEMPLATE_CREATED.id));
      expect(req.request.body).toEqual({
        weekStart: '2026-11-23',
        mode: 'REPLACE',
        includeManual: false,
        confirmedDeleteIds: deletes.map((e) => e.id),
        confirmedRestoredIds: restored.map((e) => e.templateEventId),
      });
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      req.flush(APPLY_RESULT_REPLACE);
      await appRef.whenStable();
      expect(dialogElement()).toBeNull();
    });

    it('«Назад» in the confirmation returns to the choice without sending anything', async () => {
      await ready(APPLY_PREVIEW_REPLACE, 2);
      footer('Заменить')!.click();
      await appRef.whenStable();
      footer('Назад')!.click();
      await appRef.whenStable();
      expect(root().querySelector('.confirm')).toBeNull();
      expect(footer('Отмена')).toBeDefined();
      backend.expectNone(APPLY(TEMPLATE_CREATED.id));
    });

    it('a change of the choice during the confirmation takes the question away', async () => {
      await ready(APPLY_PREVIEW_REPLACE, 2);
      footer('Заменить')!.click();
      await appRef.whenStable();
      expect(root().querySelector('.confirm')).not.toBeNull();
      button('Следующая неделя').click();
      await appRef.whenStable();
      expect(root().querySelector('.confirm')).toBeNull();
      await pause();
      backend.expectOne(PREVIEW(TEMPLATE_CREATED.id)).flush(APPLY_PREVIEW_MERGE);
    });

    it('«Заменить» with nothing to delete or restore needs no question and sends empty arrays', async () => {
      await ready({ ...APPLY_PREVIEW_REPLACE, toDelete: [], restoredDeleted: [] }, 2);
      footer('Заменить')!.click();
      const req = backend.expectOne(APPLY(TEMPLATE_CREATED.id));
      expect(req.request.body.confirmedDeleteIds).toEqual([]);
      expect(req.request.body.confirmedRestoredIds).toEqual([]);
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      req.flush(APPLY_RESULT_REPLACE);
      await appRef.whenStable();
    });

    it.each(['APPLY_PLAN_OUTDATED', 'TEMPLATE_APPLY_CONFLICT'])(
      'AP-09: 409 %s asks T6 again and says the week changed; the dialog stays',
      async (code) => {
        await ready(APPLY_PREVIEW_MERGE);
        footer('Применить')!.click();
        backend
          .expectOne(APPLY(TEMPLATE_CREATED.id))
          .flush(
            { type: 'about:blank', title: code, status: 409, code },
            { status: 409, statusText: 'Conflict' },
          );
        await appRef.whenStable();
        expect(root().querySelector('.notice')?.textContent).toContain(
          'Неделя изменилась, проверьте ещё раз.',
        );
        await pause();
        backend.expectOne(PREVIEW(TEMPLATE_CREATED.id)).flush(APPLY_PREVIEW_MERGE_AGAIN);
        await appRef.whenStable();
        expect(dialogElement()).not.toBeNull();
        // The new plan is the one on screen now: nothing to add.
        expect(footer('Применить')!.disabled).toBe(true);
        expect(root().querySelector('.notice')).not.toBeNull();
        // Changing the choice is a new question: the notice goes.
        radios('.modes')[1].click();
        await appRef.whenStable();
        expect(root().querySelector('.notice')).toBeNull();
        await pause();
        backend.expectOne(PREVIEW(TEMPLATE_CREATED.id)).flush(APPLY_PREVIEW_MERGE);
      },
    );

    it('a template deleted meanwhile: the new T6 puts the message into the dialog', async () => {
      await ready(APPLY_PREVIEW_MERGE);
      footer('Применить')!.click();
      backend
        .expectOne(APPLY(TEMPLATE_CREATED.id))
        .flush(
          { type: 'about:blank', title: 'x', status: 404, code: 'TEMPLATE_NOT_FOUND' },
          { status: 404, statusText: 'Not Found' },
        );
      backend.expectOne(LIST).flush([]);
      await pause();
      backend
        .expectOne(PREVIEW(TEMPLATE_CREATED.id))
        .flush(
          { type: 'about:blank', title: 'x', status: 404, code: 'TEMPLATE_NOT_FOUND' },
          { status: 404, statusText: 'Not Found' },
        );
      await appRef.whenStable();
      expect(root().querySelector('tp-apply-preview .error')).not.toBeNull();
      expect(footer('Применить')!.disabled).toBe(true);
    });

    it('any other error is a toast, and the dialog stays with its plan', async () => {
      const error = vi.spyOn(TestBed.inject(ToastService), 'error');
      await ready(APPLY_PREVIEW_MERGE);
      footer('Применить')!.click();
      backend
        .expectOne(APPLY(TEMPLATE_CREATED.id))
        .flush(
          { type: 'about:blank', title: 'x', status: 500, code: 'INTERNAL_ERROR' },
          { status: 500, statusText: 'x' },
        );
      await appRef.whenStable();
      expect(error).toHaveBeenCalled();
      expect(dialogElement()).not.toBeNull();
      expect(footer('Применить')!.disabled).toBe(false);
    });
  });
});
