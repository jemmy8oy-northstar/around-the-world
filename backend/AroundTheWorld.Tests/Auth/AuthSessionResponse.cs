namespace AroundTheWorld.Tests.Auth;

/// <summary>
/// Deserialisation target for the auth routes, declared against the wire contract
/// rather than the DataModel so a server-side rename fails a test.
/// </summary>
public sealed class AuthSessionResponse
{
    public string AccessToken { get; set; } = string.Empty;

    public DateTime AccessTokenExpiresAt { get; set; }

    public string RefreshToken { get; set; } = string.Empty;

    public Guid UserId { get; set; }

    public string Username { get; set; } = string.Empty;
}
