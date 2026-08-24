namespace AroundTheWorld.Abstractions.Exceptions;

/// <summary>
/// A dependency the app relies on (a downstream API, database, or other external system)
/// failed or was unreachable. Maps to HTTP 502 — the failure is upstream, not the caller's fault.
/// </summary>
public sealed class UpstreamServiceException : AppException
{
    public UpstreamServiceException(string message)
        : base(message)
    {
    }

    public UpstreamServiceException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public override string ErrorCode => "upstream_failure";
}
