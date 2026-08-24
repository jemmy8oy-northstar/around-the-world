namespace AroundTheWorld.Abstractions.Exceptions;

/// <summary>The request was well-formed but semantically invalid (a business rule rejected it). Maps to HTTP 400.</summary>
public sealed class ValidationException : AppException
{
    public ValidationException(string message)
        : base(message)
    {
    }

    public ValidationException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public override string ErrorCode => "invalid_input";
}
