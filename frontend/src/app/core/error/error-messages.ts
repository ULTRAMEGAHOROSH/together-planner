// The only dictionary of user-facing error texts (FD-67): every code of spec §7.4
// plus the client codes. Used by ToastService.error() and forms.
import { plural } from '@shared/time';
import { type ApiErrorCode, isApiError } from './api-error';

const SOMETHING_WENT_WRONG = 'Что-то пошло не так. Попробуйте ещё раз.';
const SESSION_EXPIRED = 'Сессия истекла, войдите снова.';
const WEEK_CHANGED = 'Неделя изменилась, проверьте ещё раз.';
const ALREADY_DELETED = 'Уже удалено партнёром.';

export const ERROR_MESSAGES: Readonly<Record<ApiErrorCode, string>> = {
  VALIDATION_FAILED: 'Проверьте заполнение полей.',
  // Program errors (decisions §9): the user should never see the reason.
  MALFORMED_REQUEST: SOMETHING_WENT_WRONG,
  INVALID_TIME_ZONE: 'Неизвестный часовой пояс.',
  INVALID_DATE_RANGE: 'Неверный диапазон дат.',
  PASSWORD_TOO_LONG: 'Пароль слишком длинный.',
  EVENT_END_NOT_AFTER_START: 'Окончание должно быть позже начала.',
  EVENT_TOO_LONG: 'Событие не может длиться дольше 31 дня.',
  EVENT_DATE_OUT_OF_RANGE: 'Дата должна быть между 2000 и 2100 годом.',
  EVENT_PARTICIPANT_NOT_MEMBER: 'Участник не состоит в этом пространстве.',
  VERSION_REQUIRED: SOMETHING_WENT_WRONG,
  WEEK_START_NOT_MONDAY: 'Неделя должна начинаться с понедельника.',
  TEMPLATE_EVENT_NOT_FOUND: 'Событие шаблона не найдено. Откройте шаблон заново.',
  REPLACE_CONFIRMATION_REQUIRED: SOMETHING_WENT_WRONG,
  UNAUTHORIZED: SESSION_EXPIRED,
  INVALID_CREDENTIALS: 'Неверный email или пароль.',
  REFRESH_TOKEN_INVALID: SESSION_EXPIRED,
  REFRESH_TOKEN_ROTATED: SESSION_EXPIRED,
  FORBIDDEN: 'Нет доступа.',
  CSRF_HEADER_MISSING: SOMETHING_WENT_WRONG,
  WORKSPACE_NOT_FOUND: 'Пространство не найдено.',
  INVITE_NOT_FOUND: 'Код приглашения не найден. Проверьте его.',
  EVENT_NOT_FOUND: ALREADY_DELETED,
  TEMPLATE_NOT_FOUND: ALREADY_DELETED,
  EMAIL_ALREADY_REGISTERED: 'Этот email уже зарегистрирован.',
  ALREADY_IN_WORKSPACE: 'Вы уже состоите в пространстве.',
  WORKSPACE_FULL: 'В пространстве уже двое.',
  INVITE_EXPIRED: 'Срок действия кода истёк. Попросите новый.',
  INVITE_ALREADY_USED: 'Этот код уже использован. Попросите новый.',
  TEMPLATE_NAME_TAKEN: 'Шаблон с таким названием уже есть.',
  VERSION_CONFLICT: 'Партнёр уже изменил это. Обновите и попробуйте снова.',
  TEMPLATE_APPLY_CONFLICT: WEEK_CHANGED,
  APPLY_PLAN_OUTDATED: WEEK_CHANGED,
  DATA_CONFLICT: 'Данные изменились. Обновите страницу и попробуйте снова.',
  INTERNAL_ERROR: 'Ошибка на сервере. Попробуйте позже.',
  NETWORK_ERROR: 'Нет связи с сервером. Проверьте интернет.',
  SESSION_EXPIRED,
  UNKNOWN: SOMETHING_WENT_WRONG,
};

/** Text for any caught error: ApiError by its code, anything else as UNKNOWN. */
export function messageFor(error: unknown): string {
  return ERROR_MESSAGES[isApiError(error) ? error.code : 'UNKNOWN'];
}

/**
 * Texts for errors of a single form field (CORE-12 `controlErrorMessage`). Server
 * `errors[].message` is not shown: it is a Bean Validation text in the language of the
 * server JVM (Russian locally, English in a container); the field gets `invalid` instead.
 */
export const FIELD_ERROR_MESSAGES = {
  required: 'Заполните поле.',
  email: 'Введите email, например you@example.com.',
  minlength: (min: number) => `Минимум ${min} ${plural(min, 'символ', 'символа', 'символов')}.`,
  maxlength: (max: number) => `Не больше ${max} ${plural(max, 'символа', 'символов', 'символов')}.`,
  tooLong: 'Слишком длинный текст.',
  invalid: 'Проверьте это поле.',
} as const;
