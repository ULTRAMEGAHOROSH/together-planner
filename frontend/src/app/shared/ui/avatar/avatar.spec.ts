import { TestBed } from '@angular/core/testing';
import { Avatar } from './avatar';

describe('Avatar', () => {
  async function render(name: string, seat: 1 | 2, size?: 'sm' | 'md') {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('name', name);
    fixture.componentRef.setInput('seat', seat);
    if (size) fixture.componentRef.setInput('size', size);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the first letter in the color of the seat', async () => {
    const host = await render('  алия', 1);
    expect(host.textContent).toBe('А');
    expect(host.classList).toContain('seat-1');
    expect(host.classList).not.toContain('seat-2');
    expect(host.classList).not.toContain('sm');
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });

  it('second seat, small size', async () => {
    const host = await render('Ерлан', 2, 'sm');
    expect(host.textContent).toBe('Е');
    expect(host.classList).toContain('seat-2');
    expect(host.classList).toContain('sm');
  });

  it('an empty name gives «?»', async () => {
    expect((await render('', 1)).textContent).toBe('?');
  });
});
