import { Clipboard } from '@angular/cdk/clipboard';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ProblemDetail } from '@core/api/models/common.models';
import { AUTH_RESPONSE, INVITE, WORKSPACE_CREATED } from '@core/api/models/testing/samples';
import { authInterceptor } from '@core/auth/auth-interceptor';
import { SessionStore } from '@core/auth/session-store';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { ToastService } from '@core/notify/toast-service';
import { dialogElement, provideVisibleElements } from '@shared/ui/dialog/testing';
import { InviteCard } from '../index';

const URL = `/api/v1/workspaces/${WORKSPACE_CREATED.id}/invites`;
const NEXT_INVITE = {
  code: 'K7Q2M9XD',
  displayCode: 'K7Q2-M9XD',
  expiresAt: '2026-11-25T19:30:00.123456Z',
};
const problem = (status: number, code: ProblemDetail['code']): ProblemDetail => ({
  status,
  title: 'x',
  code,
});

describe('InviteCard', () => {
  let fixture: ComponentFixture<InviteCard>;
  let backend: HttpTestingController;
  let copy: ReturnType<typeof vi.fn<(text: string) => boolean>>;

  async function setUp({ workspace = true, issueOnStart = true } = {}) {
    copy = vi.fn<(text: string) => boolean>(() => true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        provideVisibleElements(),
        { provide: Clipboard, useValue: { copy } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    if (workspace) {
      session.setWorkspace(WORKSPACE_CREATED);
    }
    fixture = TestBed.createComponent(InviteCard);
    fixture.componentRef.setInput('issueOnStart', issueOnStart);
    await stable();
  }

  afterEach(() => backend.verify());

  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.trim() ?? null;
  const button = (label: string, root: ParentNode = el()) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const toast = () => TestBed.inject(ToastService).current()?.text ?? null;
  const stable = () => TestBed.inject(ApplicationRef).whenStable();
  const link = (code: string) => `${document.location.origin}/join?code=${code}`;

  async function flushInvite(body: object = INVITE) {
    const req = backend.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(body, { status: 201, statusText: 'Created' });
    await stable();
  }
  async function failWith(status: number, code: ProblemDetail['code']) {
    backend.expectOne(URL).flush(problem(status, code), { status, statusText: 'x' });
    await stable();
  }
  async function confirmRenew(answer: 'Создать новый код' | 'Отмена') {
    button('Новый код')!.click();
    await stable();
    expect(dialogElement()?.textContent).toContain('Прежний код перестанет работать');
    button(answer, dialogElement()!)!.click();
    await stable();
  }

  it('W5 on start → the code, the link without the dash, expiry in the workspace zone', async () => {
    await setUp();
    expect(text('tp-spinner[role="status"]')).toBe('Создаём код приглашения…');
    await flushInvite();
    // 11:06 UTC is 16:06 in Asia/Almaty (UTC+5).
    expect(text('.hint')).toBe(
      'Отправьте код партнёру. Код одноразовый и действует до 24 ноября, 16:06.',
    );
    expect(text('.code')).toBe('ACZ9-AXJN');
    expect(text('.link')).toBe(link('ACZ9AXJN'));
    expect(el().querySelector('tp-spinner')).toBeNull();
  });

  it('copies the code and the link, with a toast', async () => {
    await setUp();
    await flushInvite();
    button('Скопировать код')!.click();
    expect(copy).toHaveBeenLastCalledWith('ACZ9-AXJN');
    expect(toast()).toBe('Код скопирован.');
    button('Скопировать ссылку')!.click();
    expect(copy).toHaveBeenLastCalledWith(link('ACZ9AXJN'));
    expect(toast()).toBe('Ссылка скопирована.');
  });

  it('copying fails → a toast asks to copy by hand', async () => {
    await setUp();
    await flushInvite();
    copy.mockReturnValue(false);
    button('Скопировать ссылку')!.click();
    expect(toast()).toBe('Не удалось скопировать. Выделите текст и скопируйте вручную.');
  });

  it('«Новый код» asks first: cancel sends nothing', async () => {
    await setUp();
    await flushInvite();
    await confirmRenew('Отмена');
    backend.expectNone(URL);
    expect(text('.code')).toBe('ACZ9-AXJN');
  });

  it('«Новый код» confirmed → W5 again, the old code stays until the new one comes', async () => {
    await setUp();
    await flushInvite();
    await confirmRenew('Создать новый код');
    expect(button('Новый код')!.getAttribute('aria-busy')).toBe('true');
    expect(text('.code')).toBe('ACZ9-AXJN');
    await flushInvite(NEXT_INVITE);
    expect(text('.code')).toBe('K7Q2-M9XD');
    expect(text('.link')).toBe(link('K7Q2M9XD'));
    expect(text('.hint')).toContain('действует до 26 ноября, 00:30.');
    expect(toast()).toBe('Новый код создан, прежний больше не работает.');
    expect(button('Новый код')!.getAttribute('aria-busy')).toBeNull();
  });

  it('«Новый код» fails → a toast, the shown code stays', async () => {
    await setUp();
    await flushInvite();
    await confirmRenew('Создать новый код');
    backend.expectOne(URL).error(new ProgressEvent('error'));
    await stable();
    expect(toast()).toBe(ERROR_MESSAGES.NETWORK_ERROR);
    expect(text('.code')).toBe('ACZ9-AXJN');
    expect(button('Новый код')!.getAttribute('aria-busy')).toBeNull();
  });

  it('WORKSPACE_FULL on start → «Партнёр уже присоединился»', async () => {
    await setUp();
    await failWith(409, 'WORKSPACE_FULL');
    expect(text('[role="status"]')).toBe('Партнёр уже присоединился.');
    expect(el().querySelector('button')).toBeNull();
    expect(el().querySelector('.code')).toBeNull();
    expect(el().querySelector('tp-spinner')).toBeNull();
    expect(el().querySelector('tp-error-state')).toBeNull();
    expect(toast()).toBeNull();
  });

  it('WORKSPACE_FULL on «Новый код» → the message; the shown code stays, no new one', async () => {
    await setUp();
    await flushInvite();
    await confirmRenew('Создать новый код');
    await failWith(409, 'WORKSPACE_FULL');
    expect(text('[role="status"]')).toBe('Партнёр уже присоединился.');
    expect(text('.code')).toBe('ACZ9-AXJN');
    expect(text('.link')).toBe(link('ACZ9AXJN'));
    expect(button('Новый код')!.getAttribute('aria-busy')).toBeNull();
    expect(toast()).toBeNull(); // no «Новый код создан»
  });

  it('after WORKSPACE_FULL a code that the backend does issue replaces the message', async () => {
    await setUp();
    await flushInvite();
    await confirmRenew('Создать новый код');
    await failWith(409, 'WORKSPACE_FULL');
    await confirmRenew('Создать новый код');
    await flushInvite(NEXT_INVITE);
    expect(el().querySelector('[role="status"]')).toBeNull();
    expect(text('.code')).toBe('K7Q2-M9XD');
  });

  it('another API error on «Новый код» → the common toast, the code stays', async () => {
    await setUp();
    await flushInvite();
    await confirmRenew('Создать новый код');
    await failWith(500, 'INTERNAL_ERROR');
    expect(toast()).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    expect(text('.code')).toBe('ACZ9-AXJN');
    expect(el().querySelector('[role="status"]')).toBeNull();
  });

  it('a network error on start → the error with «Повторить» → W5 again', async () => {
    await setUp();
    backend.expectOne(URL).error(new ProgressEvent('error'));
    await stable();
    expect(text('tp-error-state')).toContain(ERROR_MESSAGES.NETWORK_ERROR);
    button('Повторить')!.click();
    await stable();
    expect(el().querySelector('tp-spinner')).not.toBeNull();
    await flushInvite();
    expect(text('.code')).toBe('ACZ9-AXJN');
  });

  describe('issueOnStart = false (opened again: menu, settings)', () => {
    it('no W5 until «Получить код»; then the code as usual', async () => {
      await setUp({ issueOnStart: false });
      backend.expectNone(URL);
      expect(el().querySelector('tp-spinner')).toBeNull();
      expect(text('.hint')).toBe(
        'Партнёр присоединится по коду или по ссылке. Если вы уже отправляли код, новый его заменит.',
      );
      button('Получить код')!.click();
      await stable();
      expect(el().querySelector('tp-spinner')).not.toBeNull();
      expect(button('Получить код')).toBeUndefined();
      await flushInvite();
      expect(text('.code')).toBe('ACZ9-AXJN');
      expect(button('Новый код')).toBeDefined();
    });

    it('«Получить код» → WORKSPACE_FULL → the message, nothing else', async () => {
      await setUp({ issueOnStart: false });
      button('Получить код')!.click();
      await failWith(409, 'WORKSPACE_FULL');
      expect(text('[role="status"]')).toBe('Партнёр уже присоединился.');
      expect(button('Получить код')).toBeUndefined();
      expect(el().querySelector('tp-error-state, tp-spinner')).toBeNull();
    });
  });

  it('outside a workspace → no request, a message', async () => {
    await setUp({ workspace: false });
    backend.expectNone(URL);
    expect(text('tp-error-state')).toContain('Сначала создайте пространство.');
  });
});
