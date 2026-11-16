package com.togetherplanner.template.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.time.DayOfWeek;

/** {@code day_of_week smallint}, ISO: 1 = пн … 7 = вс (spec §5.4, §5.5). */
@Converter(autoApply = false)
public class DayOfWeekConverter implements AttributeConverter<DayOfWeek, Integer> {

    @Override
    public Integer convertToDatabaseColumn(DayOfWeek attribute) {
        return attribute == null ? null : attribute.getValue();
    }

    @Override
    public DayOfWeek convertToEntityAttribute(Integer dbData) {
        return dbData == null ? null : DayOfWeek.of(dbData);
    }
}
