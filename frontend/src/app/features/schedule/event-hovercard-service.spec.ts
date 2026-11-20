import { TestBed } from '@angular/core/testing';
import { EVENT_CREATED_MANUAL, WEEK } from '@core/api/models/testing/samples';
import { EventHovercardService, HOVERCARD_DELAY_MS } from './event-hovercard-service';

describe('EventHovercardService (WEEK-14)', () => {
  let service: EventHovercardService;
  let anchor: HTMLElement;
  const shown = () => document.querySelectorAll('tp-event-hovercard').length;

  const setHover = (hover: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: hover, media: query }));

  beforeEach(() => {
    vi.useFakeTimers();
    setHover(true);
    TestBed.configureTestingModule({ providers: [EventHovercardService] });
    service = TestBed.inject(EventHovercardService);
    anchor = document.createElement('div');
    document.body.append(anchor);
  });

  afterEach(() => {
    service.hide();
    anchor.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const show = () => service.show(EVENT_CREATED_MANUAL, WEEK.members, anchor);

  it('shows the card only after the delay: a pointer that passes over shows nothing', () => {
    show();
    vi.advanceTimersByTime(HOVERCARD_DELAY_MS - 1);
    expect(shown()).toBe(0);
    vi.advanceTimersByTime(1);
    expect(shown()).toBe(1);
  });

  it('hide before the delay cancels it; hide after removes the card', () => {
    show();
    service.hide();
    vi.advanceTimersByTime(HOVERCARD_DELAY_MS * 2);
    expect(shown()).toBe(0);
    show();
    vi.advanceTimersByTime(HOVERCARD_DELAY_MS);
    service.hide();
    expect(shown()).toBe(0);
  });

  it('a new show replaces the old card: never two at once', () => {
    show();
    vi.advanceTimersByTime(HOVERCARD_DELAY_MS);
    show();
    vi.advanceTimersByTime(HOVERCARD_DELAY_MS);
    expect(shown()).toBe(1);
  });

  it('a screen without hover (touch) never shows it', () => {
    setHover(false);
    show();
    vi.advanceTimersByTime(HOVERCARD_DELAY_MS * 2);
    expect(shown()).toBe(0);
  });

  it('is removed with the page', () => {
    show();
    vi.advanceTimersByTime(HOVERCARD_DELAY_MS);
    TestBed.resetTestingModule();
    expect(shown()).toBe(0);
  });
});
