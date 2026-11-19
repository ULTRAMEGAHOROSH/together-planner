import type { Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DataChanges } from './data-changes';

describe('DataChanges (FD-28)', () => {
  let changes: DataChanges;
  let events: Mock<() => void>;
  let templates: Mock<() => void>;

  beforeEach(() => {
    changes = TestBed.inject(DataChanges);
    events = vi.fn<() => void>();
    templates = vi.fn<() => void>();
    changes.events$.subscribe(events);
    changes.templates$.subscribe(templates);
  });

  it('eventsChanged() reaches the listeners of events only', () => {
    changes.eventsChanged();
    expect(events).toHaveBeenCalledTimes(1);
    expect(templates).not.toHaveBeenCalled();
  });

  it('templatesChanged() reaches the listeners of templates only', () => {
    changes.templatesChanged();
    expect(templates).toHaveBeenCalledTimes(1);
    expect(events).not.toHaveBeenCalled();
  });

  it('a notice is not remembered: a later listener hears nothing', () => {
    changes.eventsChanged();
    const late = vi.fn<() => void>();
    changes.events$.subscribe(late);
    expect(late).not.toHaveBeenCalled();
  });
});
