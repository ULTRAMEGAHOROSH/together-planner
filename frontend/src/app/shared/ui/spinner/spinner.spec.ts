import { TestBed } from '@angular/core/testing';
import { Spinner } from './spinner';

describe('Spinner', () => {
  async function render(inputs: Partial<Record<'label' | 'size', unknown>> = {}) {
    const fixture = TestBed.createComponent(Spinner);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('is a status with a hidden text by default', async () => {
    const host = await render();
    expect(host.getAttribute('role')).toBe('status');
    expect(host.hasAttribute('aria-hidden')).toBe(false);
    expect(host.querySelector('.tp-visually-hidden')?.textContent).toBe('Загрузка…');
    expect(host.classList).not.toContain('sm');
  });

  it('takes its own text', async () => {
    const host = await render({ label: 'Загружаем неделю…' });
    expect(host.textContent?.trim()).toBe('Загружаем неделю…');
  });

  it('without a label it is decorative', async () => {
    const host = await render({ label: null, size: 'sm' });
    expect(host.hasAttribute('role')).toBe(false);
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('.tp-visually-hidden')).toBeNull();
    expect(host.classList).toContain('sm');
  });
});
