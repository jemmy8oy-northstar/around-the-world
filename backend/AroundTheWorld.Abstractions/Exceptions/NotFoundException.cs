namespace AroundTheWorld.Abstractions.Exceptions;

/// <summary>A requested resource does not exist. Maps to HTTP 404.</summary>
public sealed class NotFoundException : AppException
{
    public NotFoundException(string message)
        : base(message)
    {
    }

    public NotFoundException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public override string ErrorCode => "not_found";
}
