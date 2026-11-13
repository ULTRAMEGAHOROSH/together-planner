package com.togetherplanner.security;

import com.togetherplanner.common.error.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** spec §7.2: {@code 403 FORBIDDEN} из {@code AccessDeniedHandler}. В этом приложении почти не встречается — чужие
 * ресурсы отдают {@code 404}, а не {@code 403} (spec §8.0). */
@Component
@RequiredArgsConstructor
public class ProblemAccessDeniedHandler implements AccessDeniedHandler {

    private final ProblemResponseWriter problemResponseWriter;

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException)
            throws IOException {
        problemResponseWriter.write(response, ErrorCode.FORBIDDEN, "Access denied", request.getRequestURI());
    }
}
