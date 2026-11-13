package com.togetherplanner.common.web;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * Обёртка страницы результатов (spec §8.2). Контроллеры никогда не
 * возвращают {@link org.springframework.data.domain.Page} напрямую — она
 * раскрывает детали Spring Data (сортировку, Pageable) в публичном API.
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
