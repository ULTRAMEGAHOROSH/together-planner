import { CATEGORY_PALETTE } from '@shared/domain/category-palette';
import { rangeText } from '@shared/time/format-ru';
import { formatLocalDateTime, formatTime, minutesOfDay } from '@shared/time/local-date-time';
import {
  CARD_FONT_SIZE,
  CARD_FONT_SIZE_TINY,
  CARD_GAP,
  CARD_RADIUS,
  CARD_RADIUS_CUT,
  DEFAULT_SLOT_MINUTE,
  LATEST_SLOT_MINUTE,
  MIN_CARD_HEIGHT,
  PX_PER_HOUR,
  PX_PER_MIN,
  SLOT_STEP_MINUTES,
  TALL_CARD_MIN_HEIGHT,
  TINY_CARD_MAX_HEIGHT,
} from './constants';
import type { CardDensity, EventBox, LaidOutSegment } from './model';

/**
 * A laid-out segment → a ready card (FD-56, prototype `segView`): position in px from the
 * day's midnight with half the gap above and below, at least `MIN_CARD_HEIGHT` tall; the
 * lane as % of the column; the small radius on an edge that continues into another day;
 * density and font by the height; time and name of the whole event, not of the segment.
 */
export function toBox(segment: LaidOutSegment, pxPerMin = PX_PER_MIN): EventBox {
  const { event } = segment;
  const height = Math.max((segment.end - segment.start) * pxPerMin - CARD_GAP, MIN_CARD_HEIGHT);
  const start = formatLocalDateTime(event.startMin);
  const end = formatLocalDateTime(event.endMin);
  const timeLabel = `${formatTime(minutesOfDay(event.startMin))}–${formatTime(minutesOfDay(event.endMin))}`;
  return {
    key: `${event.id}@${segment.date}`,
    eventId: event.id,
    title: event.title,
    top: Math.round(segment.start * pxPerMin) + CARD_GAP / 2,
    height: Math.round(height),
    leftPct: (segment.lane * 100) / segment.laneCount,
    widthPct: 100 / segment.laneCount,
    radiusTop: segment.continuesBefore ? CARD_RADIUS_CUT : CARD_RADIUS,
    radiusBottom: segment.continuesAfter ? CARD_RADIUS_CUT : CARD_RADIUS,
    density: densityOf(height),
    fontSize: height < TINY_CARD_MAX_HEIGHT ? CARD_FONT_SIZE_TINY : CARD_FONT_SIZE,
    timeLabel: `${formatTime(minutesOfDay(event.startMin))}–${formatTime(minutesOfDay(event.endMin))}`,
    // Starts with the visible text (WCAG 2.5.3), then the whole range with its date.
    ariaLabel: `${event.title} ${timeLabel}. ${rangeText(start, end)}${event.joint ? ', вместе' : ''}`,
    colors: CATEGORY_PALETTE[event.color],
    joint: event.joint,
    fromTemplate: event.fromTemplate,
  };
}

/** A label of the time gutter. */
export interface HourMark {
  readonly label: string;
  /** px; the label is centred on its hour line (16 px tall text, prototype `h * H − 8`). */
  readonly top: number;
}

/** 01:00 … 23:00 (00:00 and 24:00 are the edges of the day). */
export const HOUR_MARKS: readonly HourMark[] = Array.from({ length: 23 }, (_, i) => ({
  label: formatTime((i + 1) * 60),
  top: (i + 1) * PX_PER_HOUR - 8,
}));

/**
 * Start minute for a click on an empty slot of a day column (prototype `slotClick`):
 * the click offset from the column top, rounded down to 30 minutes, at most 23:00;
 * `null` (keyboard, no click point) → 09:00.
 */
export function slotMinuteAt(offsetPx: number | null, pxPerMin = PX_PER_MIN): number {
  if (offsetPx === null) return DEFAULT_SLOT_MINUTE;
  const minute = Math.floor(offsetPx / pxPerMin / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
  return Math.max(0, Math.min(minute, LATEST_SLOT_MINUTE));
}

function densityOf(height: number): CardDensity {
  if (height >= TALL_CARD_MIN_HEIGHT) return 'tall';
  return height < TINY_CARD_MAX_HEIGHT ? 'tiny' : 'short';
}
