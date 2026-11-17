package com.togetherplanner.template;

import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.template.entity.ApplyMode;
import com.togetherplanner.template.entity.OccurrenceExclusion;
import com.togetherplanner.template.entity.OccurrenceExclusionId;
import com.togetherplanner.template.entity.TemplateApplication;
import com.togetherplanner.template.entity.TemplateEvent;
import com.togetherplanner.template.entity.WeekTemplate;
import com.togetherplanner.template.repository.OccurrenceExclusionRepository;
import com.togetherplanner.template.repository.TemplateApplicationRepository;
import com.togetherplanner.template.repository.WeekTemplateRepository;
import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.user.entity.User;
import com.togetherplanner.user.repository.UserRepository;
import com.togetherplanner.workspace.entity.Workspace;
import com.togetherplanner.workspace.repository.WorkspaceRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Cascades on {@code week_template} deletion. */
class WeekTemplateRepositoryIT extends AbstractIntegrationTest {

    @Autowired
    private WeekTemplateRepository weekTemplateRepository;

    @Autowired
    private OccurrenceExclusionRepository occurrenceExclusionRepository;

    @Autowired
    private TemplateApplicationRepository templateApplicationRepository;

    @Autowired
    private WorkspaceRepository workspaceRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void deletingTemplateCascadesEventsAndExclusionsAndNullsApplicationTemplateId() {
        Workspace workspace = workspaceRepository.save(new Workspace("W", "Asia/Almaty", clock.instant()));
        User user = userRepository.save(new User("owner@example.com", "Owner", "hash", clock.instant()));

        WeekTemplate template = new WeekTemplate(workspace.getId(), "Usual week", null, user.getId(), clock.instant());
        TemplateEvent templateEvent = new TemplateEvent(template, "Work", null, DayOfWeek.MONDAY,
                LocalTime.of(9, 0), 240, EventCategory.WORK, null, Set.of(user.getId()));
        template.getEvents().add(templateEvent);
        template = weekTemplateRepository.save(template);
        UUID templateId = template.getId();
        UUID templateEventId = template.getEvents().get(0).getId();

        LocalDate weekStart = LocalDate.of(2026, 11, 9);
        occurrenceExclusionRepository.save(new OccurrenceExclusion(
                new OccurrenceExclusionId(templateEventId, weekStart), user.getId(), clock.instant()));

        TemplateApplication application = templateApplicationRepository.save(new TemplateApplication(
                workspace.getId(), templateId, "Usual week", weekStart, ApplyMode.MERGE, 1, 0, 0, user.getId(), clock.instant()));
        UUID applicationId = application.getId();

        weekTemplateRepository.delete(template);
        weekTemplateRepository.flush();

        assertThat(countRows("template_event", "id = ?", templateEventId)).isZero();
        assertThat(countRows("template_occurrence_exclusion", "template_event_id = ?", templateEventId)).isZero();

        TemplateApplication reloaded = templateApplicationRepository.findById(applicationId).orElseThrow();
        assertThat(reloaded.getTemplateId()).isNull();
        assertThat(reloaded.getTemplateName()).isEqualTo("Usual week");
    }

    private int countRows(String table, String where, Object param) {
        Integer count = jdbcTemplate.queryForObject("select count(*) from " + table + " where " + where, Integer.class, param);
        return count == null ? 0 : count;
    }
}
