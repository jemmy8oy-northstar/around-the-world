namespace AroundTheWorld.Abstractions.Exceptions;

/// <summary>
/// The caller is not authenticated (no or invalid credentials). Maps to HTTP 401.
/// Scaffolding for when auth lands — the template ships without auth.
/// </summary>
public sealed class UnauthorizedException : AppException
{
    public UnauthorizedException(string message)
        : base(message)
    {
    }

    public UnauthorizedException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public override string ErrorCode => "unauthenticated";
}
