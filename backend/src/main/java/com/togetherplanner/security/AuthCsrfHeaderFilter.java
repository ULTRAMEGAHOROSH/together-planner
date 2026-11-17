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
 * Defense in depth for the endpoints that can be authenticated by the
 * {@code tp_refresh} cookie alone, without a bearer token: these POSTs are
 * rejected if this header is missing. {@code /auth/logout-all} isn't in
 * the list - it's bearer-only, so it can't be forged cross-site anyway.
 *
 * <p>Instantiated with {@code new} in {@link SecurityConfig}, not as a
 * {@code @Component} - otherwise Spring Boot would also register it in
 * the regular servlet filter chain and it would run twice.
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
