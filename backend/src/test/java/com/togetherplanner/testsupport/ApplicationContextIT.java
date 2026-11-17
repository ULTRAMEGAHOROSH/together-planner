package com.togetherplanner.testsupport;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Sanity check that the context starts against a real PostgreSQL container. */
class ApplicationContextIT extends AbstractIntegrationTest {

    @Test
    void contextLoads() {
        assertThat(mockMvc).isNotNull();
        assertThat(clock).isNotNull();
    }
}
