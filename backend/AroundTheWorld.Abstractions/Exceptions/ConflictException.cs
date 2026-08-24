namespace AroundTheWorld.Abstractions.Exceptions;

/// <summary>The request conflicts with the current state (e.g. a duplicate or a lost update). Maps to HTTP 409.</summary>
public sealed class ConflictException : AppException
{
    public ConflictException(string message)
        : base(message)
    {
    }

    public ConflictException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public override string ErrorCode => "conflict";
}
