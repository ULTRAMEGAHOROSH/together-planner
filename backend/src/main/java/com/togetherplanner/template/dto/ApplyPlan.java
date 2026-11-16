package com.togetherplanner.template.dto;

import com.togetherplanner.event.dto.EventResponse;

import java.util.List;

/**
 * Результат {@code ApplyPlanner.plan(PlanInput)} (spec §9.4 называет тип
 * в заголовке алгоритма, но не даёт его полям явного определения —
 * реконструирован по {@link ApplyPreviewResponse}, с которым совпадает
 * набором вычисляемых списков). Без {@code weekStart}/{@code mode}: это
 * входные параметры, а не результат планирования — их эхо в HTTP-ответе
 * (T6/T7) добавляет вызывающий слой ({@code TemplateApplyService},
 * этап 7), а не сам чистый планировщик.
 */
public record ApplyPlan(
        List<PlannedEvent> toCreate,
        List<PlannedEvent> skippedAlreadyApplied,
        List<PlannedEvent> skippedDeleted,
        List<PlannedEvent> skippedBusy,
        List<PlannedEvent> restoredDeleted,
        List<ApplyConflict> conflicts,
        List<EventResponse> toDelete,
        int manualEventsInWeek) {
}
