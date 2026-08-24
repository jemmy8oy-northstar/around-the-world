using AroundTheWorld.Abstractions.Exceptions;

namespace AroundTheWorld.WebApi.ExceptionHandling;

/// <summary>
/// The HTTP shape an exception maps to at the API boundary: a status code, a short
/// human title, and the machine-readable <c>errorCode</c>. Kept as a pure, side-effect-free
/// resolution so it is unit-testable without spinning up the HTTP pipeline.
/// </summary>
/// <param name="StatusCode">The HTTP status code to return.</param>
/// <param name="Title">A short, stable title for the failure category.</param>
/// <param name="ErrorCode">The machine-readable code clients branch on.</param>
/// <param name="ExposeMessage">
/// Whether the exception's own message is safe to surface to the caller. True for
/// anticipated <see cref="AppException"/>s (developer-authored), false for unexpected
/// faults — those must not leak internal detail.
/// </param>
public readonly record struct ExceptionResult(int StatusCode, string Title, string ErrorCode, bool ExposeMessage)
{
    /// <summary>Detail returned when an unexpected (non-<see cref="AppException"/>) fault is caught.</summary>
    public const string GenericDetail = "An unexpected error occurred.";

    /// <summary>
    /// Maps an exception to its HTTP result. Every <see cref="AppException"/> subclass has an
    /// explicit mapping; anything else is an unexpected fault and becomes a 500 whose message
    /// is <em>not</em> exposed. When you add a new <see cref="AppException"/> subclass, add its
    /// arm here too.
    /// </summary>
    public static ExceptionResult Resolve(Exception exception) => exception switch
    {
        NotFoundException e => new(StatusCodes.Status404NotFound, "Resource not found", e.ErrorCode, ExposeMessage: true),
        ValidationException e => new(StatusCodes.Status400BadRequest, "Invalid request", e.ErrorCode, ExposeMessage: true),
        ConflictException e => new(StatusCodes.Status409Conflict, "Conflict", e.ErrorCode, ExposeMessage: true),
        UnauthorizedException e => new(StatusCodes.Status401Unauthorized, "Not authenticated", e.ErrorCode, ExposeMessage: true),
        ForbiddenException e => new(StatusCodes.Status403Forbidden, "Forbidden", e.ErrorCode, ExposeMessage: true),
        UpstreamServiceException e => new(StatusCodes.Status502BadGateway, "Upstream service failure", e.ErrorCode, ExposeMessage: true),
        // Defensive: a future AppException subclass with no explicit mapping is still an
        // anticipated failure — surface its code and message as a 400 rather than a 500.
        AppException e => new(StatusCodes.Status400BadRequest, "Request failed", e.ErrorCode, ExposeMessage: true),
        _ => new(StatusCodes.Status500InternalServerError, "Internal server error", "internal_error", ExposeMessage: false),
    };
}
