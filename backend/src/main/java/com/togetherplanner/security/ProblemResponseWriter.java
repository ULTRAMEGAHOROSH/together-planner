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
 * Единый формат {@code ProblemDetail} для ответов, которые пишутся вне
 * {@code GlobalExceptionHandler} — до того, как запрос дошёл до контроллера
 * (фильтры безопасности, spec §7.2, §10). Используется
 * {@code ProblemAuthenticationEntryPoint}, {@code ProblemAccessDeniedHandler}
 * и {@code AuthCsrfHeaderFilter}.
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
