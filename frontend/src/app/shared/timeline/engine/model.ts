// Timeline engine model (FD-50…56): plain data in, plain data out. The engine never sees a
// DTO: `toTimelineEvents` is the only place where `EventResponse` becomes `TimelineEvent`.
// Pipeline: TimelineEvent[] → Segment[] (WEEK-02) → LaidOutSegment[] (WEEK-03)
// → EventBox / DayColumnLayout / PanelLayout (WEEK-04).
import type { IsoDate, Uuid } from '@core/api/models/common.models';
import type { EventCategory, EventColor } from '@core/api/models/enums';
import type { CategoryStyle } from '@shared/domain/category-palette';
import type { LocalMinutes } from '@shared/time/local-date-time';

/** Engine input (FD-51). Times are local minutes of the workspace calendar, half-open. */
export interface TimelineEvent {
  readonly id: Uuid;
  readonly title: string;
  /** Start, inclusive. */
  readonly startMin: LocalMinutes;
  /** End, exclusive: an event 22:00 → 00:00 does not touch the next day. */
  readonly endMin: LocalMinutes;
  /** 1–2 user ids; a set on the backend, so the order means nothing. */
  readonly participantIds: readonly Uuid[];
  readonly category: EventCategory;
  /** Palette key, already resolved: own color or the category's (FD-62). */
  readonly color: EventColor;
  /** Both members take part: shown in both panels with «вместе» (FD-55). */
  readonly joint: boolean;
  /** Created by applying a template (`source` in the DTO). */
  readonly fromTemplate: boolean;
}

/** What is shown (FD-52): the week (7 days from Monday) or one day. */
export interface DayRange {
  readonly firstDay: IsoDate;
  readonly dayCount: 1 | 7;
}

/**
 * The part of one event inside one day of the range (FD-53). Minutes count from that
 * day's midnight: `0 ≤ start < end ≤ 1440`, half-open.
 */
export interface Segment {
  readonly event: TimelineEvent;
  readonly date: IsoDate;
  /** Position of the day in the range, 0-based. */
  readonly dayIndex: number;
  readonly start: number;
  readonly end: number;
  /** The event started on an earlier day: the top edge is cut (small radius). */
  readonly continuesBefore: boolean;
  /** The event goes on into the next day: the bottom edge is cut. */
  readonly continuesAfter: boolean;
}

/** A segment with its lane among the overlapping segments of its day (FD-54). */
export interface LaidOutSegment extends Segment {
  /** 0-based lane inside the cluster. */
  readonly lane: number;
  /** Lanes in the cluster: the card is `1 / laneCount` wide. */
  readonly laneCount: number;
}

/**
 * How much fits on a card (prototype): `tall` — title and time on two lines, `short` —
 * one line, `tiny` — one line in the small font.
 */
export type CardDensity = 'tall' | 'short' | 'tiny';

/** Ready-to-draw card (FD-56, FD-59): the component only reads these values. */
export interface EventBox {
  /** Unique within a panel: one event has a box per day it touches. */
  readonly key: string;
  readonly eventId: Uuid;
  readonly title: string;
  /** px from the day's midnight line. */
  readonly top: number;
  /** px, at least `MIN_CARD_HEIGHT`. */
  readonly height: number;
  /** % of the day column. */
  readonly leftPct: number;
  readonly widthPct: number;
  /** px: `CARD_RADIUS`, or `CARD_RADIUS_CUT` on an edge that continues into another day. */
  readonly radiusTop: number;
  readonly radiusBottom: number;
  readonly density: CardDensity;
  /** px. */
  readonly fontSize: number;
  /** Time of the whole event, e.g. «23:00–07:00». */
  readonly timeLabel: string;
  /** Name of the card button: title, `rangeText`, «вместе». */
  readonly ariaLabel: string;
  /** Card colors from `CATEGORY_PALETTE`. */
  readonly colors: CategoryStyle;
  readonly joint: boolean;
  readonly fromTemplate: boolean;
}

/** The «now» line: the day it is on, px from that day's midnight and the label «14:20». */
export interface NowMark {
  readonly date: IsoDate;
  readonly top: number;
  readonly label: string;
}

/** A gap in which both are free, ready to draw (WEEK-15, prototype `freeSlots`). */
export interface FreeSlotBox {
  readonly key: string;
  /** px from the day's midnight line. */
  readonly top: number;
  readonly height: number;
  /** «09:00–10:30». */
  readonly timeLabel: string;
  /** The label «Оба свободны» fits. */
  readonly showLabel: boolean;
  /** The time fits under the label. */
  readonly showTime: boolean;
}

/** One day column of a panel. */
export interface DayColumnLayout {
  readonly date: IsoDate;
  /** Day header: «Пн». */
  readonly weekdayShort: string;
  /** Day header: 9; `null` on a conditional week (template preview): weekdays only. */
  readonly dayOfMonth: number | null;
  /** «понедельник, 9 ноября» — for the name of the day column button (§8.3). */
  readonly dateLabel: string;
  readonly isToday: boolean;
  readonly isWeekend: boolean;
  readonly boxes: readonly EventBox[];
  /** The gaps of both members; empty when the free time is off (WEEK-15). */
  readonly free: readonly FreeSlotBox[];
}

/** One member's panel: the view model of the board (FD-59). */
export interface PanelLayout {
  readonly personId: Uuid;
  readonly days: readonly DayColumnLayout[];
}
