package com.togetherplanner.template;

import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.template.dto.ApplyTemplateRequest;
import com.togetherplanner.template.dto.TemplateEventRequest;
import com.togetherplanner.template.dto.TemplateRequest;
import com.togetherplanner.template.dto.TemplateResponse;
import com.togetherplanner.template.entity.ApplyMode;
import com.togetherplanner.template.repository.TemplateApplicationRepository;
import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * spec §14.3 (I-14). Отдельный класс: {@code @MockitoSpyBean} переопределяет
 * бин для всего контекста этого класса, Spring помечает контекст «грязным» и
 * пересоздаёт его для следующего класса — не смешиваем это с TemplateApplyIT.
 */
class TemplateApplyRollbackIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 11, 9);

    @MockitoSpyBean
    private TemplateApplicationRepository templateApplicationRepository;

    @Test
    void aFailureSavingTheApplicationLogRollsBackDeletesAndCreates() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        TemplateResponse template = testApi.createTemplate(alice.accessToken(), workspace.id(), new TemplateRequest(
                "Usual week", null, List.of(new TemplateEventRequest(null, "t1", null, DayOfWeek.MONDAY,
                        LocalTime.of(9, 0), 240, Set.of(alice.userId()), EventCategory.WORK, null)), null));
        testApi.applyTemplate(alice.accessToken(), workspace.id(), template.id(),
                new ApplyTemplateRequest(WEEK_START, ApplyMode.MERGE, false, null, null));
        List<EventResponse> beforeReplace = testApi.listEvents(alice.accessToken(), workspace.id(), WEEK_START, WEEK_START.plusDays(6));
        assertThat(beforeReplace).hasSize(1);

        doThrow(new RuntimeException("boom")).when(templateApplicationRepository).save(any());

        Set<UUID> deleteIds = beforeReplace.stream().map(EventResponse::id).collect(Collectors.toSet());
        testApi.postApply(alice.accessToken(), workspace.id(), template.id(),
                        new ApplyTemplateRequest(WEEK_START, ApplyMode.REPLACE, false, deleteIds, Set.of()))
                .andExpect(status().isInternalServerError());

        List<EventResponse> afterRollback = testApi.listEvents(alice.accessToken(), workspace.id(), WEEK_START, WEEK_START.plusDays(6));
        assertThat(afterRollback).hasSize(1);
        assertThat(afterRollback.get(0).id()).isEqualTo(beforeReplace.get(0).id()); // удаление откатилось, новое не создано

        mockMvc.perform(MockMvcRequestBuilders.get("/api/v1/workspaces/" + workspace.id() + "/template-applications")
                        .header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1)); // запись не создана; осталась только от MERGE
    }
}
