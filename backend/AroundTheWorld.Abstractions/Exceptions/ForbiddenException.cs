namespace AroundTheWorld.Abstractions.Exceptions;

/// <summary>
/// The caller is authenticated but not permitted to perform this action. Maps to HTTP 403.
/// Scaffolding for when auth lands — the template ships without auth.
/// </summary>
public sealed class ForbiddenException : AppException
{
    public ForbiddenException(string message)
        : base(message)
    {
    }

    public ForbiddenException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public override string ErrorCode => "forbidden";
}
