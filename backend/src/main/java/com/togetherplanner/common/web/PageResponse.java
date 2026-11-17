package com.togetherplanner.common.web;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * Page wrapper for API responses. Controllers never return a
 * {@link org.springframework.data.domain.Page} directly - it leaks Spring
 * Data internals (sorting, Pageable) into the public API.
 */
public record PageResponse<T>(List<T> items, int page, int size, long totalElements,
                               int totalPages, boolean hasNext) {

    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.hasNext());
    }
}
