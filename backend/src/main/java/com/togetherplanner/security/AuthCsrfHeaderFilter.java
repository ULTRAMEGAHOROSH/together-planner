package com.togetherplanner.security;

import com.togetherplanner.common.error.ErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * Защита в глубину для четырёх эндпоинтов, где запрос может быть
 * аутентифицирован cookie {@code tp_refresh} без Bearer-токена (spec §8.0,
 * §10.5): без этого заголовка POST отклоняется. {@code /auth/logout-all}
 * сюда не входит — он только {@code bearer}, подделать его межсайтово и так
 * нельзя.
 *
 * <p>Создаётся через {@code new} в {@link SecurityConfig}, а не
 * {@code @Component}: иначе Spring Boot зарегистрировал бы его ещё и в
 * обычной цепочке сервлет-фильтров, и он сработал бы дважды.
 */
public class AuthCsrfHeaderFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Requested-With";
    private static final String EXPECTED_VALUE = "XMLHttpRequest";

    private static final Set<String> PROTECTED_PATHS = Set.of(
            "/api/v1/auth/register",
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
            "/api/v1/auth/logout");

    private final ProblemResponseWriter problemResponseWriter;

    public AuthCsrfHeaderFilter(ProblemResponseWriter problemResponseWriter) {
        this.problemResponseWriter = problemResponseWriter;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        boolean needsCheck = HttpMethod.POST.matches(request.getMethod())
                && PROTECTED_PATHS.contains(request.getRequestURI());
        if (needsCheck && !EXPECTED_VALUE.equals(request.getHeader(HEADER))) {
            problemResponseWriter.write(response, ErrorCode.CSRF_HEADER_MISSING,
                    "Missing or invalid X-Requested-With header", request.getRequestURI());
            return;
        }
        filterChain.doFilter(request, response);
    }
}
