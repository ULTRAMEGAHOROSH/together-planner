package com.togetherplanner.security;

import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.testsupport.RegisteredUser;
import com.togetherplanner.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ErrorResponseAndCorsIT extends AbstractIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    void the500ResponseContainsNoStacktraceOrSql() throws Exception {
        RegisteredUser alice = testApi.register("alice@example.com", "Alice");
        // A valid JWT that now points at a user who no longer exists - a real
        // path to 500 through UserService.getById, no mocks needed.
        userRepository.deleteById(alice.userId());

        MvcResult result = mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + alice.accessToken()))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).doesNotContainIgnoringCase("exception");
        assertThat(body).doesNotContainIgnoringCase("stacktrace");
        assertThat(body).doesNotContainIgnoringCase("select ");
        assertThat(body).doesNotContain("com.togetherplanner");
        assertThat(body).doesNotContain(alice.userId().toString());
    }

    @Test
    void corsPreflightFromAForeignOriginGetsNoAccessControlAllowOriginHeader() throws Exception {
        mockMvc.perform(options("/api/v1/auth/refresh")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
}
