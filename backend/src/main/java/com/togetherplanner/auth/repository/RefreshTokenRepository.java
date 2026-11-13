package com.togetherplanner.auth.repository;

import com.togetherplanner.auth.entity.RefreshToken;
import com.togetherplanner.auth.entity.RevokeReason;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** Условный UPDATE (spec §10.4, шаг 5): {@code 0} означает, что гонку выиграл параллельный запрос. */
    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now, t.revokeReason = :reason "
            + "where t.id = :id and t.revokedAt is null")
    int revokeIfActive(@Param("id") UUID id, @Param("reason") RevokeReason reason, @Param("now") Instant now);

    /** Массовый отзыв при logout-all или обнаруженном повторном использовании (spec §10.4). */
    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now, t.revokeReason = :reason "
            + "where t.userId = :userId and t.revokedAt is null")
    int revokeAllActive(@Param("userId") UUID userId, @Param("reason") RevokeReason reason, @Param("now") Instant now);

    /** {@code RefreshTokenCleanupJob} (spec §10.4). */
    @Modifying
    @Query("delete from RefreshToken t where t.expiresAt < :now")
    int deleteExpired(@Param("now") Instant now);
}
