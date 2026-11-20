// What the user chooses before the preview (TPL-05): which template, which week and how.
// Only the choice lives here; what the backend will do with it is its plan (FD-84, TPL-06).
import type { IsoDate, Uuid } from '@core/api/models/common.models';
import type { ApplyMode } from '@core/api/models/enums';
import type { ApplyTemplateRequest } from '@core/api/models/template.models';
import { addDays, daysBetween, weekStartOf } from '@shared/time';

export interface ApplyParams {
  /** `null` — nothing is chosen (no templates yet). */
  templateId: Uuid | null;
  /** Always a Monday (T6 and T7 answer `WEEK_START_NOT_MONDAY` otherwise). */
  weekStart: IsoDate;
  mode: ApplyMode;
  /** Only meaningful for `REPLACE`; `false` for the other modes. */
  includeManual: boolean;
}

export interface ApplyModeOption {
  mode: ApplyMode;
  title: string;
  description: string;
}

/** The three modes with the texts of the prototype. */
export const APPLY_MODE_OPTIONS: readonly ApplyModeOption[] = [
  {
    mode: 'MERGE',
    title: 'Добавить к существующим',
    description:
      'События шаблона добавятся в неделю. То, что уже создано из этого шаблона, пропускается — дубликатов не будет.',
  },
  {
    mode: 'FILL',
    title: 'Только в свободные дни',
    description:
      'Событие добавится, только если у его участников в этот день ещё ничего не запланировано.',
  },
  {
    mode: 'REPLACE',
    title: 'Заменить',
    description:
      'Сначала удалит события из шаблонов в этой неделе, затем применит шаблон заново. Созданное вручную по умолчанию останется.',
  },
];

/** Only «Заменить» can delete what was created by hand, so only it asks. */
export function asksIncludeManual(mode: ApplyMode): boolean {
  return mode === 'REPLACE';
}

/** The Monday of the week `date` belongs to: a week is always chosen by its Monday. */
export function mondayOf(date: IsoDate): IsoDate {
  return weekStartOf(date);
}

/** The week `weeks` weeks away (negative — earlier); a Monday stays a Monday. */
export function shiftWeek(weekStart: IsoDate, weeks: number): IsoDate {
  return addDays(weekStart, weeks * 7);
}

/** Whole weeks from `from` to `to` (both Mondays). */
export function weeksBetween(from: IsoDate, to: IsoDate): number {
  return daysBetween(from, to) / 7;
}

/**
 * The T6 body for the choice: `includeManual` only for «Заменить»; the confirmed sets are
 * for T7 and are taken from the preview on screen (TPL-07), never from here.
 */
export function toApplyRequest(
  params: Pick<ApplyParams, 'weekStart' | 'mode' | 'includeManual'>,
): ApplyTemplateRequest {
  return {
    weekStart: params.weekStart,
    mode: params.mode,
    includeManual: asksIncludeManual(params.mode) && params.includeManual,
    confirmedDeleteIds: null,
    confirmedRestoredIds: null,
  };
}
