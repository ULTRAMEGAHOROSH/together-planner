package com.togetherplanner.common.error;

/**
 * Общий приём для E5, E6, T4, T5 (spec §9.7): явная проверка версии от
 * клиента. JPA запрещает менять поле {@code @Version} вручную, поэтому
 * сравниваем сами, а не подставляем в сущность. {@code @Version} на
 * сущности — второй, независимый рубеж против гонки между этой проверкой
 * и SQL (spec §11).
 */
public final class VersionGuard {

    private VersionGuard() {
    }

    public static void requireVersion(Long expected, long actual) {
        if (expected == null) {
            throw new ApiException(ErrorCode.VERSION_REQUIRED, "Version is required");
        }
        if (expected != actual) {
            throw new ApiException(ErrorCode.VERSION_CONFLICT, "The resource was modified since the version you have");
        }
    }
}
