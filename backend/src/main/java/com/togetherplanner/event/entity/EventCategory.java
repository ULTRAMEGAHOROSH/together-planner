package com.togetherplanner.event.entity;

/** Adding a category means a value here, one in {@link EventColor}, and a migration that rebuilds the four CHECK constraints. */
public enum EventCategory {
    WORK, SLEEP, FOOD, COMMUTE, SPORT, REST, TOGETHER, TRIP, OTHER
}
