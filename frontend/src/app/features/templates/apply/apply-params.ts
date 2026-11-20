// What the user chooses before the preview (TPL-05): which template, which week and how.
// Only the choice lives here; what the backend will do with it is its plan (FD-84, TPL-06).
import type { IsoDate, Uuid } from '@core/api/models/common.models';
import type { ApplyMode } from '@core/api/models/enums';
import type {
  ApplyPreviewResponse,
  ApplyTemplateRequest,
  TemplateApplicationResponse,
} from '@core/api/models/template.models';
import { addDays, daysBetween, weekShort, weekStartOf } from '@shared/time';

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

export function sameParams(a: ApplyParams | null, b: ApplyParams | null): boolean {
  return (
    a !== null &&
    b !== null &&
    a.templateId === b.templateId &&
    a.weekStart === b.weekStart &&
    a.mode === b.mode &&
    a.includeManual === b.includeManual
  );
}

/**
 * The T7 body for the plan **on screen**: for «Заменить» the two confirmed sets are exactly
 * what the preview lists (`toDelete[].id`, `restoredDeleted[].templateEventId`), empty arrays
 * included — `null` there is `REPLACE_CONFIRMATION_REQUIRED`. The other modes send `null`.
 */
export function toConfirmedRequest(
  params: ApplyParams,
  preview: Pick<ApplyPreviewResponse, 'toDelete' | 'restoredDeleted'>,
): ApplyTemplateRequest {
  const request = toApplyRequest(params);
  return params.mode === 'REPLACE'
    ? {
        ...request,
        confirmedDeleteIds: preview.toDelete.map((event) => event.id),
        confirmedRestoredIds: preview.restoredDeleted.map((planned) => planned.templateEventId),
      }
    : request;
}

/**
 * The toast after an application, in the manner of the prototype: «“Обычная неделя” →
 * 9–15 нояб.: добавлено 12, удалено 3, пропущено 4». Nothing created is said plainly.
 */
export function applyResultText(
  application: Pick<
    TemplateApplicationResponse,
    'templateName' | 'weekStart' | 'createdCount' | 'deletedCount' | 'skippedCount'
  >,
): string {
  const head = `«${application.templateName}» → ${weekShort(application.weekStart)}: `;
  const deleted = application.deletedCount > 0 ? `удалено ${application.deletedCount}` : null;
  if (application.createdCount === 0) {
    return `${head}ничего не добавлено${deleted === null ? ': всё уже применено' : `, ${deleted}`}`;
  }
  const parts = [`добавлено ${application.createdCount}`];
  if (deleted !== null) parts.push(deleted);
  if (application.skippedCount > 0) {
    parts.push(`без дублей: пропущено ${application.skippedCount}`);
  }
  return head + parts.join(', ');
}
