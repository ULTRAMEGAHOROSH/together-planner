package com.togetherplanner.testsupport;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** spec §1.6 DoD: контекст поднимается на настоящем PostgreSQL в контейнере. */
class ApplicationContextIT extends AbstractIntegrationTest {

    @Test
    void contextLoads() {
        assertThat(mockMvc).isNotNull();
        assertThat(clock).isNotNull();
    }
}
