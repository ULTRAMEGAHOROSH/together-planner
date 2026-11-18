import { TestBed } from '@angular/core/testing';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('shows the message as an alert; «Повторить» asks to retry', async () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('text', 'Нет связи с сервером. Проверьте интернет.');
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.getAttribute('role')).toBe('alert');
    expect(host.querySelector('p')?.textContent).toBe('Нет связи с сервером. Проверьте интернет.');
    expect(host.querySelector('tp-icon')?.getAttribute('aria-hidden')).toBe('true');

    const retry = host.querySelector('button')!;
    expect(retry.textContent?.trim()).toBe('Повторить');
    expect(retry.type).toBe('button');
    expect(retry.classList).toContain('ghost');
    retry.click();
    retry.click();
    expect(retries).toBe(2);
  });
});
