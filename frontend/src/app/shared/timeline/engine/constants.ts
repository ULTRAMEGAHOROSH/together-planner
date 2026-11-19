// Timeline geometry and thresholds — all the numbers of the board (FD-56…58), from the
// prototype (design/Main.dc.html: H, PPM, segView, layout, scroll).
import { DAY_MINUTES } from '@shared/time/local-date-time';

/** Re-exported so the engine and the board take every number from here. */
export { DAY_MINUTES };

/** Height of one hour. */
export const PX_PER_HOUR = 40;
/** 2/3 px per minute. */
export const PX_PER_MIN = PX_PER_HOUR / 60;
/** Height of a whole day: 960 px. */
export const DAY_HEIGHT = (DAY_MINUTES / 60) * PX_PER_HOUR;

/** Vertical gap between touching cards: 1 px above and 1 px below each card. */
export const CARD_GAP = 2;
/** A 5-minute event is still clickable. */
export const MIN_CARD_HEIGHT = 14;
export const CARD_RADIUS = 8;
/** Radius of an edge that continues into the previous or the next day. */
export const CARD_RADIUS_CUT = 3;

/** Density thresholds by card height (px): `tall` from 36, `tiny` below 20, else `short`. */
export const TALL_CARD_MIN_HEIGHT = 36;
export const TINY_CARD_MAX_HEIGHT = 20;
export const CARD_FONT_SIZE = 12;
export const CARD_FONT_SIZE_TINY = 10.5;

/** A week opens scrolled to 06:00 (FD-58). */
export const SCROLL_START_HOUR = 6;

/** Minimal board width in the «Неделя» mode; narrower → horizontal scroll (FD-57). */
export const WEEK_MIN_WIDTH = 1080;
/** Below this width only «День» (§8.2); the same value as the `narrow` mixin (FD-60). */
export const NARROW_BREAKPOINT = 820;
