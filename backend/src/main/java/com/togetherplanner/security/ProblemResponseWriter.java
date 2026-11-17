package com.togetherplanner.security;

import com.togetherplanner.common.error.ErrorCode;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;

/**
 * Shared {@code ProblemDetail} format for responses written outside
 * {@code GlobalExceptionHandler} - before the request reaches a
 * controller (security filters). Used by
 * {@code ProblemAuthenticationEntryPoint}, {@code ProblemAccessDeniedHandler}
 * and {@code AuthCsrfHeaderFilter}.
 */
@Component
@RequiredArgsConstructor
public class ProblemResponseWriter {

    private final JsonMapper jsonMapper;

    public void write(HttpServletResponse response, ErrorCode code, String detail, String instancePath)
            throws IOException {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(code.getStatus(), detail);
        body.setProperty("code", code.name());
        if (instancePath != null) {
            body.setInstance(URI.create(instancePath));
        }
        response.setStatus(code.getStatus().value());
        response.setContentType("application/problem+json");
        jsonMapper.writeValue(response.getOutputStream(), body);
    }
}
