import { TestBed } from '@angular/core/testing';
import { NowIndicator } from './now-indicator';

describe('tp-now-indicator (WEEK-07)', () => {
  it('stands at `top` px, is decorative and does not take clicks', async () => {
    const fixture = TestBed.createComponent(NowIndicator);
    fixture.componentRef.setInput('top', 573);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.style.top).toBe('573px');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('.dot')).not.toBeNull();

    fixture.componentRef.setInput('top', 580);
    await fixture.whenStable();
    expect(host.style.top).toBe('580px');
  });
});
