package com.togetherplanner.event;

import com.togetherplanner.event.entity.Event;
import com.togetherplanner.event.entity.EventCategory;
import com.togetherplanner.event.repository.EventRepository;
import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.user.entity.User;
import com.togetherplanner.user.repository.UserRepository;
import com.togetherplanner.workspace.entity.Workspace;
import com.togetherplanner.workspace.repository.WorkspaceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Overlap boundary cases at the repository level. */
class EventRepositoryIT extends AbstractIntegrationTest {

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private WorkspaceRepository workspaceRepository;

    @Autowired
    private UserRepository userRepository;

    private UUID wsId;
    private UUID userId;

    @BeforeEach
    void createWorkspaceAndUser() {
        Workspace workspace = workspaceRepository.save(new Workspace("W", "Asia/Almaty", clock.instant()));
        User user = userRepository.save(new User("owner@example.com", "Owner", "hash", clock.instant()));
        wsId = workspace.getId();
        userId = user.getId();
    }

    @Test
    void overlappingRespectsHalfOpenRangeBoundaries() {
        save(LocalDateTime.of(2026, 11, 1, 8, 0), LocalDateTime.of(2026, 11, 1, 9, 0));                 // entirely before the range
        save(LocalDateTime.of(2026, 11, 8, 22, 0), LocalDateTime.of(2026, 11, 9, 0, 0));                // ends exactly at from - no
        Event overlapsStart = save(LocalDateTime.of(2026, 11, 8, 23, 0), LocalDateTime.of(2026, 11, 9, 7, 0));  // straddles from - yes
        Event inside = save(LocalDateTime.of(2026, 11, 10, 10, 0), LocalDateTime.of(2026, 11, 10, 11, 0));      // entirely inside - yes
        save(LocalDateTime.of(2026, 11, 16, 0, 0), LocalDateTime.of(2026, 11, 16, 1, 0));                // starts exactly at to - no
        Event overlapsEnd = save(LocalDateTime.of(2026, 11, 15, 23, 0), LocalDateTime.of(2026, 11, 16, 7, 0));  // straddles to - yes

        List<Event> result = eventRepository.findOverlapping(wsId,
                LocalDateTime.of(2026, 11, 9, 0, 0), LocalDateTime.of(2026, 11, 16, 0, 0));

        assertThat(result).extracting(Event::getId)
                .containsExactly(overlapsStart.getId(), inside.getId(), overlapsEnd.getId());
    }

    @Test
    void manualEventLoadsWithNullSource() {
        Event event = save(LocalDateTime.of(2026, 11, 10, 10, 0), LocalDateTime.of(2026, 11, 10, 11, 0));

        Event reloaded = eventRepository.findById(event.getId()).orElseThrow();

        assertThat(reloaded.getSource()).isNull();
    }

    private Event save(LocalDateTime start, LocalDateTime end) {
        Event event = new Event(wsId, "Event", null, start, end, EventCategory.WORK, null, null,
                Set.of(userId), userId, clock.instant());
        return eventRepository.save(event);
    }
}
