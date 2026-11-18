// How workspace members are shown: seat colors, avatar letter, "who" text (prototype).
import type { Uuid } from '@core/api/models/common.models';
import type { MemberResponse, Seat } from '@core/api/models/workspace.models';

// Seat colors live in styles/_tokens.scss (FD-60); here only references to them.
const SEAT_COLOR: Readonly<Record<Seat, string>> = {
  1: 'var(--tp-color-seat-1)',
  2: 'var(--tp-color-seat-2)',
};
const SEAT_TINT: Readonly<Record<Seat, string>> = {
  1: 'var(--tp-color-seat-1-tint)',
  2: 'var(--tp-color-seat-2-tint)',
};

/** Main color of a seat (avatar, column header), as a CSS value. */
export function seatColor(seat: Seat): string {
  return SEAT_COLOR[seat];
}

/** Light background of a seat (selected participant chip), as a CSS value. */
export function seatTint(seat: Seat): string {
  return SEAT_TINT[seat];
}

/** Avatar letter: first character of the trimmed name in upper case, «?» for an empty name. */
export function initialOf(name: string | null | undefined): string {
  const [first] = Array.from((name ?? '').trim());
  return first ? first.toUpperCase() : '?';
}

/**
 * Who takes part: «вместе» for both members, otherwise the member's name.
 * An id that is not in `members` (out-of-date data) gives an empty string.
 */
export function whoText(
  participantIds: readonly Uuid[],
  members: readonly MemberResponse[],
): string {
  if (participantIds.length > 1) {
    return 'вместе';
  }
  const member = members.find((m) => m.userId === participantIds[0]);
  return member?.displayName ?? '';
}
