import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastService } from '@core/notify/toast-service';
import { ToastHost } from './toast-host';

describe('ToastHost', () => {
  let fixture: ComponentFixture<ToastHost>;
  let host: HTMLElement;
  let toasts: ToastService;

  const card = () => host.querySelector<HTMLElement>('.toast');
  const status = () => host.querySelector<HTMLElement>('[role="status"]')!;
  const button = (text: string) =>
    Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === text || b.getAttribute('aria-label') === text,
    );

  // Fake timers also stop the zoneless scheduler, so whenStable() would wait forever:
  // change detection is run by hand.
  const render = () => fixture.detectChanges();

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(ToastHost);
    host = fixture.nativeElement as HTMLElement;
    toasts = TestBed.inject(ToastService);
    render();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has a polite live region in the DOM even without a toast', () => {
    expect(card()).toBeNull();
    expect(status().getAttribute('aria-live')).toBe('polite');
    expect(status().textContent?.trim()).toBe('');
  });

  it('the screen reader gets the text once: from the live region', () => {
    toasts.show('Событие удалено');
    render();
    expect(status().textContent?.trim()).toBe('Событие удалено');
    const visibleText = card()!.querySelector('.text')!;
    expect(visibleText.textContent?.trim()).toBe('Событие удалено');
    expect(visibleText.getAttribute('aria-hidden')).toBe('true');
    expect(button('Закрыть уведомление')).toBeDefined();
  });

  it('a new toast replaces the card', () => {
    toasts.show('Первый');
    render();
    const first = card();
    toasts.show('Второй');
    render();
    expect(host.querySelectorAll('.toast')).toHaveLength(1);
    expect(card()).not.toBe(first); // re-created: the fade-in runs again
    expect(status().textContent?.trim()).toBe('Второй');
  });

  it('hides after 4.8 s', () => {
    toasts.show('Сохранено');
    render();
    vi.advanceTimersByTime(4800);
    render();
    expect(card()).toBeNull();
    expect(status().textContent?.trim()).toBe('');
  });

  it('the action button calls the callback and closes the toast', () => {
    const run = vi.fn();
    toasts.show('Событие создано · неделя 16–22 нояб.', { action: { label: 'Показать', run } });
    render();
    button('Показать')!.click();
    render();
    expect(run).toHaveBeenCalledOnce();
    expect(card()).toBeNull();
  });

  it('no action button without an action; the close button closes', () => {
    toasts.show('Сохранено');
    render();
    expect(host.querySelectorAll('button')).toHaveLength(1);
    button('Закрыть уведомление')!.click();
    render();
    expect(card()).toBeNull();
  });

  it('stays while hovered or focused, then gets the full time again', () => {
    toasts.show('Сохранено');
    render();
    card()!.dispatchEvent(new MouseEvent('mouseenter'));
    button('Закрыть уведомление')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    card()!.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(10_000);
    expect(toasts.current()).not.toBeNull(); // still focused
    button('Закрыть уведомление')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    vi.advanceTimersByTime(4799);
    expect(toasts.current()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(toasts.current()).toBeNull();
  });
});
