package com.togetherplanner.event;

import com.togetherplanner.event.dto.EventResponse;
import com.togetherplanner.event.dto.NewTemplateEvent;
import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.event.repository.EventRepository;
import com.togetherplanner.event.service.EventService;
import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.workspace.dto.WorkspaceResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code @Transactional} on the class is a deliberate exception to the
 * usual rule of leaving it off {@code *IT} tests so requests commit the
 * way they would in production: this test needs ONE transaction across
 * both calls, the same way {@code TemplateApplyService.apply} does. Two
 * separate HTTP calls would mean two separate transactions, and the
 * insert-before-delete race this test checks for would never reproduce.
 */
@Transactional
class EventServiceIT extends AbstractIntegrationTest {

    @Autowired
    private EventService eventService;

    @Autowired
    private EventRepository eventRepository;

    @Test
    void deletingAndRecreatingTheSameSourceKeyInOneTransactionDoesNotViolateTheUniqueIndex() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");
        WorkspaceResponse workspace = testApi.createWorkspace(alice.accessToken(), "Our week", "Asia/Almaty");
        UUID templateEventId = UUID.randomUUID();
        LocalDate weekStart = LocalDate.of(2026, 11, 9);

        EventResponse original = eventService.createFromTemplate(workspace.id(), alice.userId(), List.of(
                newTemplateEvent(templateEventId, weekStart, LocalDateTime.of(2026, 11, 9, 9, 0),
                        LocalDateTime.of(2026, 11, 9, 13, 0)))).get(0);

        eventService.deleteForTemplateReplace(workspace.id(), List.of(original.id()));

        List<EventResponse> recreated = eventService.createFromTemplate(workspace.id(), alice.userId(), List.of(
                newTemplateEvent(templateEventId, weekStart, LocalDateTime.of(2026, 11, 9, 9, 0),
                        LocalDateTime.of(2026, 11, 9, 13, 0))));

        // Without an explicit flush() here, both assertions below would still
        // pass on broken code: createFromTemplate returns a DTO built from
        // entities already matched in memory, and Hibernate might never send
        // the actual INSERT/DELETE to Postgres before the test rolls back.
        // flush() forces the SQL to run so the ordering actually gets checked.
        eventRepository.flush();

        assertThat(recreated).hasSize(1);
        assertThat(recreated.get(0).source().templateEventId()).isEqualTo(templateEventId);
        assertThat(recreated.get(0).id()).isNotEqualTo(original.id());
    }

    private NewTemplateEvent newTemplateEvent(UUID templateEventId, LocalDate weekStart, LocalDateTime start, LocalDateTime end) {
        return new NewTemplateEvent("Work", null, start, end, Set.of(), EventCategory.WORK, null,
                templateEventId, weekStart, "Usual week");
    }
}
