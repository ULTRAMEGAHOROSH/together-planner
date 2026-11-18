// Event category palette — the only place with category colors (FD-62).
// Values from the prototype (design/Main.dc.html, CATS).
import type { EventCategory, EventColor } from '@core/api/models/enums';

export interface CategoryStyle {
  /** Russian name shown in the form and the legend. */
  label: string;
  /** Card background. */
  bg: string;
  /** Card text. */
  fg: string;
  /** Marker dot and hover ring. */
  dot: string;
}

/** Keys are `EventCategory` values; `EventColor` uses the same keys (spec §5.6). */
export const CATEGORY_PALETTE: Readonly<Record<EventCategory, CategoryStyle>> = {
  WORK: { label: 'Работа', bg: '#DCE7FA', fg: '#1B4A86', dot: '#3E73C6' },
  SLEEP: { label: 'Сон', bg: '#E8E4F6', fg: '#463A8A', dot: '#7B6CC9' },
  FOOD: { label: 'Еда', bg: '#FBEACF', fg: '#7A4A00', dot: '#D99A2B' },
  COMMUTE: { label: 'Дорога', bg: '#ECEDF0', fg: '#454B57', dot: '#8A909C' },
  SPORT: { label: 'Спорт', bg: '#D7F0E1', fg: '#1A603C', dot: '#3AA36B' },
  REST: { label: 'Отдых', bg: '#D5EEEE', fg: '#175C5C', dot: '#33A0A0' },
  TOGETHER: { label: 'Вместе', bg: '#FADDE8', fg: '#86284F', dot: '#D65A8C' },
  TRIP: { label: 'Поездка', bg: '#FFE0CC', fg: '#8F3A0C', dot: '#E5793A' },
  OTHER: { label: 'Другое', bg: '#EEE9E2', fg: '#574B3E', dot: '#A6927B' },
};

/** Anything with a category and an optional color: events, template events, planned events. */
export interface Colored {
  category: EventCategory;
  color: EventColor | null;
}

/** Palette key of an event: its own color, or the category's (spec §5.3). */
export function colorKeyOf(event: Colored): EventColor {
  return event.color ?? event.category;
}

/** Colors of an event card. */
export function styleOf(event: Colored): CategoryStyle {
  return CATEGORY_PALETTE[colorKeyOf(event)];
}
