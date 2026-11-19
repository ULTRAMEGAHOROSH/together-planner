import { TestBed } from '@angular/core/testing';
import { ViewContext } from './view-context';

describe('ViewContext', () => {
  it('has no focus day until a page sets one; setFocusDate(null) clears it', () => {
    const context = TestBed.inject(ViewContext);
    expect(context.focusDate()).toBeNull();
    context.setFocusDate('2026-11-09');
    expect(context.focusDate()).toBe('2026-11-09');
    context.setFocusDate(null);
    expect(context.focusDate()).toBeNull();
  });
});
