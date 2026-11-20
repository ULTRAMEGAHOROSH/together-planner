import { Location } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { type Observable, of } from 'rxjs';
import {
  AUTH_RESPONSE,
  TEMPLATE_CREATED,
  TEMPLATE_WITH_LAST_APPLICATION,
  WEEK,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import type { WorkspaceResponse } from '@core/api/models/workspace.models';
import { SessionStore } from '@core/auth/session-store';
import { DataChanges } from '@core/changes/data-changes';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { ToastService } from '@core/notify/toast-service';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { ApplyTemplateEntry } from '../apply/apply-entry';
import { TEMPLATE_SAVED_TEXT, TemplateEditorPage } from './template-editor-page';

// The sample templates belong to the members of WEEK, so the workspace takes them.
const WORKSPACE = { ...WORKSPACE_FULL_PAIR, members: WEEK.members } as unknown as WorkspaceResponse;
const LIST = `/api/v1/workspaces/${WORKSPACE.id}/templates`;
const ONE = `${LIST}/${TEMPLATE_CREATED.id}`;
const problem = (code: string, status: number) => ({
  type: 'about:blank',
  title: code,
  status,
  code,
});

describe('TemplateEditorPage (TPL-04)', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<TemplateEditorPage>;
  let toast: ToastService;
  let navigate: ReturnType<typeof vi.spyOn>;
  let replaceState: ReturnType<typeof vi.spyOn>;
  let open: ReturnType<typeof vi.spyOn>;
  const host = () => fixture.nativeElement as HTMLElement;
  const rows = () => host().querySelectorAll('tp-template-event-row');
  const page = () => fixture.componentInstance;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE);
    backend = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    replaceState = vi
      .spyOn(TestBed.inject(Location), 'replaceState')
      .mockImplementation(() => undefined);
    open = vi.spyOn(TestBed.inject(DialogService), 'open');
  });

  afterEach(() => backend.verify());

  async function openPage(templateId?: string) {
    fixture = TestBed.createComponent(TemplateEditorPage);
    if (templateId !== undefined) {
      fixture.componentRef.setInput('templateId', templateId);
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function openExisting(template = TEMPLATE_CREATED) {
    await openPage(template.id);
    backend.expectOne(`${LIST}/${template.id}`).flush(template);
    await fixture.whenStable();
  }

  function type(selector: string, value: string) {
    const control = host().querySelector(selector) as HTMLInputElement;
    control.value = value;
    control.dispatchEvent(new Event('input'));
  }

  const click = (text: string) =>
    (
      Array.from(host().querySelectorAll('button')).find((b) =>
        b.textContent?.includes(text),
      ) as HTMLButtonElement
    ).click();

  const submit = () =>
    (host().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));

  it('a new template: no request, an empty form with seven days', async () => {
    await openPage();
    backend.expectNone(() => true);
    expect(host().querySelector('h1')?.textContent).toBe('Новый шаблон');
    expect(host().querySelectorAll('section.day')).toHaveLength(7);
    expect(rows()).toHaveLength(0);
  });

  it('TPL-08: «Применить к неделе» opens the dialog for the saved template; off while unsaved changes', async () => {
    const openForTemplate = vi
      .spyOn(TestBed.inject(ApplyTemplateEntry), 'openForTemplate')
      .mockImplementation(() => undefined);
    await openPage();
    expect(host().textContent).not.toContain('Применить к неделе');

    await openExisting();
    const apply = () =>
      Array.from(host().querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Применить к неделе'),
      ) as HTMLButtonElement;
    expect(apply().disabled).toBe(false);
    apply().click();
    expect(openForTemplate).toHaveBeenCalledWith(TEMPLATE_CREATED.id);

    type('input[formcontrolname="name"]', 'Другое имя');
    await fixture.whenStable();
    expect(apply().disabled).toBe(true);
  });

  it('TPL-09: «Сетка» shows the form as a week, a card leads back to its row', async () => {
    await openExisting();
    const tab = (name: string) =>
      Array.from(host().querySelectorAll('tp-segmented-control [role="radio"]')).find(
        (b) => b.textContent?.trim() === name,
      ) as HTMLElement;
    expect(host().querySelector('tp-template-preview')).toBeNull();

    tab('Сетка').click();
    await fixture.whenStable();
    expect(host().querySelector('tp-template-preview')).not.toBeNull();
    // The list stays in the page (hidden): the form is whole, the save works.
    expect(host().querySelectorAll('section.day.hidden')).toHaveLength(7);
    const cards = host().querySelectorAll('tp-template-preview tp-event-card button');
    expect(cards.length).toBeGreaterThan(0);

    (cards[0] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(host().querySelector('tp-template-preview')).toBeNull();
    expect(host().querySelectorAll('section.day.hidden')).toHaveLength(0);
  });

  it('TPL-09: the grid follows unsaved edits', async () => {
    await openExisting();
    const count = () => host().querySelectorAll('tp-template-preview tp-event-card').length;
    (
      Array.from(host().querySelectorAll('tp-segmented-control [role="radio"]')).find(
        (b) => b.textContent?.trim() === 'Сетка',
      ) as HTMLElement
    ).click();
    await fixture.whenStable();
    const before = count();
    // An event of no length is no event for the grid: end = start of the first row.
    const first = host().querySelector('tp-template-event-row') as HTMLElement;
    const start = first.querySelector('[aria-label="Время начала"]') as HTMLInputElement;
    const end = first.querySelector('[aria-label="Время окончания"]') as HTMLInputElement;
    end.value = start.value;
    end.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(count()).toBeLessThan(before);
  });

  it('an existing template loads by T3 and its events stand in their days, by start time', async () => {
    await openExisting();
    expect(host().querySelector('h1')?.textContent).toBe('Обычная неделя');
    expect(rows()).toHaveLength(3);
    const counts = Array.from(host().querySelectorAll('section.day')).map(
      (day) => day.querySelectorAll('tp-template-event-row').length,
    );
    // Monday, Tuesday and Sunday have one event each.
    expect(counts).toEqual([1, 1, 0, 0, 0, 0, 1]);
  });

  it('a failed load shows the error with «Повторить»', async () => {
    await openPage(TEMPLATE_CREATED.id);
    backend.expectOne(ONE).flush(problem('INTERNAL_ERROR', 500), { status: 500, statusText: 'x' });
    await fixture.whenStable();
    expect(host().querySelector('tp-error-state')).not.toBeNull();
    (host().querySelector('tp-error-state button') as HTMLButtonElement).click();
    backend.expectOne(ONE).flush(TEMPLATE_CREATED);
    await fixture.whenStable();
    expect(rows()).toHaveLength(3);
  });

  it('a template that is gone: a toast and the list', async () => {
    const show = vi.spyOn(toast, 'show');
    await openPage(TEMPLATE_CREATED.id);
    backend
      .expectOne(ONE)
      .flush(problem('TEMPLATE_NOT_FOUND', 404), { status: 404, statusText: 'x' });
    expect(show).toHaveBeenCalledWith(ERROR_MESSAGES.TEMPLATE_NOT_FOUND);
    expect(navigate).toHaveBeenCalledWith(['/templates']);
    // Nothing is left to protect on the way out.
    expect(page().confirmLeave()).toBe(true);
  });

  it('«Событие» in a day adds a row with id null; the save sends it, ids of the others stay', async () => {
    await openExisting();
    click('Событие');
    await fixture.whenStable();
    expect(rows()).toHaveLength(4);
    type('tp-template-event-row:first-of-type [aria-label="Название"]', 'x');
    fixture.componentInstance['form']().controls.events.at(3).controls.title.setValue('Новое');
    submit();
    const req = backend.expectOne(ONE);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.version).toBe(0);
    const ids = req.request.body.events.map((e: { id: string | null }) => e.id);
    expect(ids).toEqual([...TEMPLATE_CREATED.events.map((e) => e.id), null]);
    req.flush(TEMPLATE_CREATED);
  });

  it('create: T2, then the form is rebuilt from the answer and the next save is T4 (no duplicates)', async () => {
    const show = vi.spyOn(toast, 'show');
    const changed = vi.fn();
    TestBed.inject(DataChanges).templates$.subscribe(changed);
    await openPage();
    type('input[formcontrolname="name"]', 'Обычная неделя');
    click('Событие');
    await fixture.whenStable();
    page()['form']().controls.events.at(0).controls.title.setValue('Работа');
    submit();
    const create = backend.expectOne(LIST);
    expect(create.request.method).toBe('POST');
    expect(create.request.body.events).toHaveLength(1);
    expect(create.request.body.events[0].id).toBeNull();
    expect('version' in create.request.body).toBe(false);
    create.flush(
      { ...TEMPLATE_CREATED, events: [TEMPLATE_CREATED.events[0]] },
      { status: 201, statusText: 'Created' },
    );
    await fixture.whenStable();
    expect(show).toHaveBeenCalledWith(TEMPLATE_SAVED_TEXT);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(`/templates/${TEMPLATE_CREATED.id}`);
    expect(host().querySelector('h1')?.textContent).toBe('Обычная неделя');

    submit();
    const update = backend.expectOne(ONE);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body.version).toBe(0);
    expect(update.request.body.events.map((e: { id: string }) => e.id)).toEqual([
      TEMPLATE_CREATED.events[0].id,
    ]);
    update.flush({ ...TEMPLATE_CREATED, version: 1 });
    await fixture.whenStable();
    // Saved again, and the address is not touched a second time.
    expect(replaceState).toHaveBeenCalledTimes(1);
  });

  it('an invalid form is not sent, and shows its errors', async () => {
    await openPage();
    submit();
    await fixture.whenStable();
    backend.expectNone(() => true);
    expect(host().querySelector('.error')?.textContent).toContain('Заполните поле');
  });

  it('«Удалить» of a row removes the event from the save; the others keep their ids', async () => {
    await openExisting();
    const second = host().querySelectorAll('tp-template-event-row')[1];
    (
      Array.from(second.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Удалить'),
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(rows()).toHaveLength(2);
    submit();
    const req = backend.expectOne(ONE);
    expect(req.request.body.events.map((e: { id: string }) => e.id)).toEqual([
      TEMPLATE_CREATED.events[0].id,
      TEMPLATE_CREATED.events[2].id,
    ]);
    req.flush(TEMPLATE_CREATED);
  });

  it('«Дублировать» adds a copy with id null', async () => {
    await openExisting();
    const first = host().querySelectorAll('tp-template-event-row')[0];
    (
      Array.from(first.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Дублировать'),
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(rows()).toHaveLength(4);
    submit();
    const req = backend.expectOne(ONE);
    const events = req.request.body.events as { id: string | null; title: string }[];
    expect(events.filter((e) => e.id === null).map((e) => e.title)).toEqual([
      TEMPLATE_CREATED.events[0].title,
    ]);
    req.flush(TEMPLATE_CREATED);
  });

  it('TEMPLATE_NAME_TAKEN lands on the name', async () => {
    await openExisting();
    submit();
    backend
      .expectOne(ONE)
      .flush(problem('TEMPLATE_NAME_TAKEN', 409), { status: 409, statusText: 'x' });
    await fixture.whenStable();
    expect(
      host().querySelector('tp-form-field .error, tp-form-field [role="alert"]')?.textContent,
    ).toContain(ERROR_MESSAGES.TEMPLATE_NAME_TAKEN);
    expect(page()['saving']()).toBe(false);
  });

  it('409 on save: the conflict dialog; «Загрузить актуальную» reloads by T3 and saves with the new version', async () => {
    open.mockReturnValue(of(true));
    await openExisting();
    submit();
    backend
      .expectOne(ONE)
      .flush(problem('VERSION_CONFLICT', 409), { status: 409, statusText: 'x' });
    expect(open).toHaveBeenCalled();
    backend.expectOne(ONE).flush({ ...TEMPLATE_WITH_LAST_APPLICATION, name: 'Чужое', version: 3 });
    await fixture.whenStable();
    expect(host().querySelector('h1')?.textContent).toBe('Чужое');
    submit();
    const req = backend.expectOne(ONE);
    expect(req.request.body.version).toBe(3);
    req.flush(TEMPLATE_CREATED);
  });

  it('409 on save and «Отмена»: the form stays as it is', async () => {
    open.mockReturnValue(of(undefined));
    await openExisting();
    submit();
    backend
      .expectOne(ONE)
      .flush(problem('VERSION_CONFLICT', 409), { status: 409, statusText: 'x' });
    backend.expectNone(ONE);
    expect(host().querySelector('h1')?.textContent).toBe('Обычная неделя');
  });

  it('404 on save: a toast and the list', async () => {
    const show = vi.spyOn(toast, 'show');
    await openExisting();
    submit();
    backend
      .expectOne(ONE)
      .flush(problem('TEMPLATE_NOT_FOUND', 404), { status: 404, statusText: 'x' });
    expect(show).toHaveBeenCalledWith(ERROR_MESSAGES.TEMPLATE_NOT_FOUND);
    expect(navigate).toHaveBeenCalledWith(['/templates']);
  });

  it('any other error is a toast', async () => {
    const error = vi.spyOn(toast, 'error');
    await openExisting();
    submit();
    backend.expectOne(ONE).flush(problem('INTERNAL_ERROR', 500), { status: 500, statusText: 'x' });
    expect(error).toHaveBeenCalled();
  });

  it('leaving: free while nothing changed; with edits it asks, and follows the answer', async () => {
    await openExisting();
    expect(page().confirmLeave()).toBe(true);
    page()['form']().controls.name.setValue('Другое');

    open.mockReturnValueOnce(of(true));
    let stay: boolean | undefined;
    (page().confirmLeave() as Observable<boolean>).subscribe((v) => (stay = v));
    expect(stay).toBe(true);

    open.mockReturnValueOnce(of(undefined));
    (page().confirmLeave() as Observable<boolean>).subscribe((v) => (stay = v));
    expect(stay).toBe(false);
  });

  it('after a save there is nothing to protect again', async () => {
    await openExisting();
    page()['form']().controls.name.setValue('Другое');
    submit();
    backend.expectOne(ONE).flush(TEMPLATE_CREATED);
    expect(page().confirmLeave()).toBe(true);
  });

  it('the browser tab warns about unsaved edits only', async () => {
    await openExisting();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    page()['form']().controls.name.setValue('Другое');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('«Назад» goes to the list', async () => {
    await openPage();
    (host().querySelector('.back') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/templates']);
  });
});
