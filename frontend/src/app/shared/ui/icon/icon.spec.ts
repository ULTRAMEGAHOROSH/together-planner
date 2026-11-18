import { TestBed } from '@angular/core/testing';
import { Icon, ICON_NAMES, type IconName } from './icon';

describe('Icon', () => {
  async function render(name: IconName, size?: number) {
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', name);
    if (size !== undefined) fixture.componentRef.setInput('size', size);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    return { host, svg: host.querySelector('svg')! };
  }

  it.each(ICON_NAMES)('%s draws its shape', async (name) => {
    const { svg } = await render(name);
    expect(svg.children.length).toBeGreaterThan(0);
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('every icon has its own shape', async () => {
    const shapes = new Set<string>();
    for (const name of ICON_NAMES) shapes.add((await render(name)).svg.innerHTML);
    expect(shapes.size).toBe(ICON_NAMES.length);
  });

  it('is decorative and 18 px by default', async () => {
    const { host, svg } = await render('close');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('width')).toBe('18');
    expect(svg.getAttribute('height')).toBe('18');
    expect(svg.getAttribute('stroke-width')).toBe('2');
  });

  it('takes a size; stroke widths follow the prototype', async () => {
    const plus = await render('plus', 14);
    expect(plus.svg.getAttribute('width')).toBe('14');
    expect(plus.svg.getAttribute('stroke-width')).toBe('2.2');
    expect((await render('check')).svg.getAttribute('stroke-width')).toBe('2.4');
  });
});
