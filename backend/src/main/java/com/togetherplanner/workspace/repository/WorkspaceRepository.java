package com.togetherplanner.workspace.repository;

import com.togetherplanner.workspace.entity.Workspace;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface WorkspaceRepository extends JpaRepository<Workspace, UUID> {

    /**
     * spec §11. Единственная пессимистическая блокировка в системе — только
     * для применения шаблона (этап 7). Вызывающий метод должен уже быть
     * {@code @Transactional}: блокировка держится до конца ЕГО транзакции,
     * сама по себе эта строка никакой транзакции не открывает.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from Workspace w where w.id = :id")
    Optional<Workspace> findByIdForUpdate(@Param("id") UUID id);
}
