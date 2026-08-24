using AroundTheWorld.Abstractions.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace AroundTheWorld.WebApi.ExceptionHandling;

/// <summary>
/// The single global exception handler. It catches everything that escapes a route, maps it
/// to an RFC 7807 <c>ProblemDetails</c> response via <see cref="ExceptionResult"/>, and logs
/// it. This removes the need for any per-route try/catch: services throw the correct
/// <see cref="AppException"/> and the response shape is decided here in one place.
/// </summary>
/// <remarks>
/// Registered with <c>AddExceptionHandler</c>/<c>UseExceptionHandler</c>. Returning <c>true</c>
/// marks the exception handled; the framework short-circuits the response.
/// </remarks>
public sealed class AppExceptionHandler(IProblemDetailsService problemDetailsService, ILogger<AppExceptionHandler> logger)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var result = ExceptionResult.Resolve(exception);

        // Unexpected faults (5xx) are logged with the full exception; anticipated failures
        // (4xx) are expected control flow, so log them at a lower level without the stack.
        if (result.StatusCode >= StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception, "Unhandled exception on {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        }
        else
        {
            logger.LogWarning("{ErrorCode} on {Method} {Path}: {Message}",
                result.ErrorCode, httpContext.Request.Method, httpContext.Request.Path, exception.Message);
        }

        httpContext.Response.StatusCode = result.StatusCode;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = result.StatusCode,
                Title = result.Title,
                Detail = result.ExposeMessage ? exception.Message : ExceptionResult.GenericDetail,
                Extensions = { ["errorCode"] = result.ErrorCode },
            },
        });
    }
}
