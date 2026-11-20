import { TestBed } from '@angular/core/testing';
import type { FreeSlotBox } from '../../engine/model';
import { FreeSlot } from './free-slot';

const box = (over: Partial<FreeSlotBox> = {}): FreeSlotBox => ({
  key: 'f420',
  top: 281,
  height: 78,
  timeLabel: '07:00–09:00',
  showLabel: true,
  showTime: true,
  ...over,
});

describe('tp-free-slot (WEEK-15)', () => {
  async function render(slot: FreeSlotBox) {
    const fixture = TestBed.createComponent(FreeSlot);
    fixture.componentRef.setInput('slot', slot);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('is placed by the box, decorative, and says «Оба свободны» with the time', async () => {
    const host = await render(box());
    expect(host.style.top).toBe('281px');
    expect(host.style.height).toBe('78px');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('.label')?.textContent).toBe('Оба свободны');
    expect(host.querySelector('.time')?.textContent).toBe('07:00–09:00');
  });

  it('a low block has no time, a lower one has no label', async () => {
    const noTime = await render(box({ showTime: false }));
    expect(noTime.querySelector('.label')).not.toBeNull();
    expect(noTime.querySelector('.time')).toBeNull();
    const bare = await render(box({ showLabel: false, showTime: false }));
    expect(bare.textContent?.trim()).toBe('');
  });
});
