package com.togetherplanner.common.error;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.net.URI;

/**
 * Единая точка превращения исключений в {@code ProblemDetail} с полем
 * {@code code} (spec §7.1, §7.2). Таблица соответствий исключение → код
 * воспроизводит spec §7.2 построчно.
 *
 * <p>{@code 401} и {@code 403} из Spring Security сюда не попадают — они
 * возникают в фильтрах до контроллеров и пишутся
 * {@code ProblemAuthenticationEntryPoint} / {@code ProblemAccessDeniedHandler}
 * через общий {@code ProblemResponseWriter} (появятся в модуле {@code security}).
 */
@Slf4j
@RequiredArgsConstructor
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private final ConstraintErrorMapper constraintErrorMapper;

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ProblemDetail> handleApiException(ApiException ex, HttpServletRequest request) {
        return problemResponse(ex.getCode(), ex.getMessage(), request);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ProblemDetail> handleConstraintViolation(
            ConstraintViolationException ex, HttpServletRequest request) {
        return problemResponse(ErrorCode.VALIDATION_FAILED, ex.getMessage(), request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ProblemDetail> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        String detail = "Parameter '%s' has an invalid value".formatted(ex.getName());
        return problemResponse(ErrorCode.MALFORMED_REQUEST, detail, request);
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ProblemDetail> handleOptimisticLocking(
            ObjectOptimisticLockingFailureException ex, HttpServletRequest request) {
        return problemResponse(ErrorCode.VERSION_CONFLICT, "The resource was modified concurrently", request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ProblemDetail> handleDataIntegrityViolation(
            DataIntegrityViolationException ex, HttpServletRequest request) {
        ErrorCode code = constraintErrorMapper.map(ex);
        return problemResponse(code, "The request conflicts with existing data", request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception while processing {} {}", request.getMethod(), request.getRequestURI(), ex);
        return problemResponse(ErrorCode.INTERNAL_ERROR, "Internal error", request);
    }

    // --- Переопределения ResponseEntityExceptionHandler: тело уже ProblemDetail, добавляем "code" ---

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ResponseEntity<Object> response = super.handleMethodArgumentNotValid(ex, headers, status, request);
        ProblemDetail body = (ProblemDetail) response.getBody();
        body.setProperty("code", ErrorCode.VALIDATION_FAILED.name());
        body.setProperty("errors", ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new ValidationErrorItem(fe.getField(), fe.getDefaultMessage()))
                .toList());
        return response;
    }

    @Override
    protected ResponseEntity<Object> handleHandlerMethodValidationException(
            HandlerMethodValidationException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ResponseEntity<Object> response = super.handleHandlerMethodValidationException(ex, headers, status, request);
        ((ProblemDetail) response.getBody()).setProperty("code", ErrorCode.VALIDATION_FAILED.name());
        return response;
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            org.springframework.http.converter.HttpMessageNotReadableException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ResponseEntity<Object> response = super.handleHttpMessageNotReadable(ex, headers, status, request);
        ((ProblemDetail) response.getBody()).setProperty("code", ErrorCode.MALFORMED_REQUEST.name());
        return response;
    }

    @Override
    protected ResponseEntity<Object> handleMissingServletRequestParameter(
            MissingServletRequestParameterException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ResponseEntity<Object> response = super.handleMissingServletRequestParameter(ex, headers, status, request);
        ((ProblemDetail) response.getBody()).setProperty("code", ErrorCode.MALFORMED_REQUEST.name());
        return response;
    }

    private ResponseEntity<ProblemDetail> problemResponse(ErrorCode code, String detail, HttpServletRequest request) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(code.getStatus(), detail);
        body.setProperty("code", code.name());
        body.setInstance(URI.create(request.getRequestURI()));
        return ResponseEntity.status(code.getStatus()).body(body);
    }
}
