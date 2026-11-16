package com.togetherplanner.event.entity;

/** spec §5.6. Новая категория = значение здесь + в {@link EventColor} + миграция, пересоздающая четыре CHECK. */
public enum EventCategory {
    WORK, SLEEP, FOOD, COMMUTE, SPORT, REST, TOGETHER, TRIP, OTHER
}
