package com.togetherplanner.common.error;

/**
 * Shared version check used before any update or delete that takes a
 * client-supplied version. JPA won't let us set {@code @Version} by hand,
 * so we compare it ourselves instead of writing it onto the entity.
 * {@code @Version} on the entity is the second, independent line of
 * defense against a race between this check and the actual SQL.
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
