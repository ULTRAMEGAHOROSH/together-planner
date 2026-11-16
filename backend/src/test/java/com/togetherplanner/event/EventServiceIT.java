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
 * spec §9.5, шаг 7; roadmap 7.1. {@code @Transactional} на классе —
 * единственное отступление от общей конвенции (spec §14.1 требует её
 * отсутствия для {@code *IT}, чтобы запросы коммитили, как в реальности):
 * здесь намеренно нужна ОДНА транзакция на оба вызова, как внутри
 * {@code TemplateApplyService.apply} (этап 7.3) — через два отдельных
 * HTTP-вызова это были бы две отдельные транзакции, и гонка с удалением
 * раньше вставки (A-02) просто не воспроизвелась бы.
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

        // Без явного flush() здесь обе проверки ниже проходили бы и на сломанном коде:
        // createFromTemplate возвращает DTO из уже сматченных в памяти сущностей,
        // а Hibernate мог бы никогда не отправить INSERT/DELETE в Postgres до ROLLBACK
        // в конце теста. flush() заставляет реально выполнить SQL и проверить порядок.
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
