import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/error/api-error';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { TOAST_DURATION_MS, ToastService } from './toast-service';

describe('ToastService (FD-68)', () => {
  let toasts: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast with defaults', () => {
    expect(toasts.current()).toBeNull();
    toasts.show('Событие удалено');
    expect(toasts.current()).toEqual({
      id: expect.any(Number),
      text: 'Событие удалено',
      action: null,
      durationMs: 4800,
    });
  });

  it('a new toast replaces the previous one and restarts the timer', () => {
    toasts.show('Первый');
    const first = toasts.current()!.id;
    vi.advanceTimersByTime(4000);
    toasts.show('Второй');
    expect(toasts.current()?.text).toBe('Второй');
    expect(toasts.current()?.id).not.toBe(first);
    vi.advanceTimersByTime(4000); // 8 s after the first one
    expect(toasts.current()?.text).toBe('Второй');
    vi.advanceTimersByTime(800);
    expect(toasts.current()).toBeNull();
  });

  it('hides after 4.8 s', () => {
    expect(TOAST_DURATION_MS).toBe(4800);
    toasts.show('Сохранено');
    vi.advanceTimersByTime(4799);
    expect(toasts.current()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(toasts.current()).toBeNull();
  });

  it('respects a custom duration', () => {
    toasts.show('Долго', { durationMs: 10_000 });
    vi.advanceTimersByTime(9999);
    expect(toasts.current()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(toasts.current()).toBeNull();
  });

  it('runAction calls the callback and closes the toast', () => {
    const run = vi.fn(() => expect(toasts.current()).toBeNull());
    toasts.show('Событие перенесено · неделя 16–22 нояб.', { action: { label: 'Показать', run } });
    toasts.runAction();
    expect(run).toHaveBeenCalledOnce();
    expect(toasts.current()).toBeNull();
    toasts.runAction(); // nothing to run
    expect(run).toHaveBeenCalledOnce();
  });

  it('dismiss closes the toast and cancels its timer', () => {
    toasts.show('Первый');
    toasts.dismiss();
    expect(toasts.current()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pause stops the timer, resume starts the full duration again', () => {
    toasts.show('Наведи на меня');
    vi.advanceTimersByTime(4000);
    toasts.pause();
    vi.advanceTimersByTime(60_000);
    expect(toasts.current()).not.toBeNull();
    toasts.resume();
    vi.advanceTimersByTime(4799);
    expect(toasts.current()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(toasts.current()).toBeNull();
    toasts.resume(); // no toast: no timer
    expect(vi.getTimerCount()).toBe(0);
  });

  it('error shows the user text of the error code', () => {
    toasts.error(new ApiError('EVENT_NOT_FOUND', { status: 404 }));
    expect(toasts.current()?.text).toBe('Уже удалено партнёром.');
    toasts.error(new Error('bug'));
    expect(toasts.current()?.text).toBe(ERROR_MESSAGES.UNKNOWN);
  });

  it('stops the timer when the app is destroyed', () => {
    toasts.show('Пока');
    expect(vi.getTimerCount()).toBe(1);
    TestBed.resetTestingModule();
    expect(vi.getTimerCount()).toBe(0);
  });
});
