using AroundTheWorld.Abstractions.DataModels;

namespace AroundTheWorld.DataModels.Models;

/// <summary>
/// Flat on purpose: a nested interface-typed user would give the OpenAPI document
/// an empty schema and the generated frontend client an untyped field.
/// </summary>
public class AuthSession : IAuthSession
{
    public required string AccessToken { get; set; }

    public DateTime AccessTokenExpiresAt { get; set; }

    public required string RefreshToken { get; set; }

    public Guid UserId { get; set; }

    public required string Username { get; set; }

    /// <summary>
    /// Whether this session owns the admin surface. Sent so the app can show the
    /// admin tab without decoding its own token — the token stays the thing the
    /// server actually trusts, and this is only what the UI draws.
    /// </summary>
    public bool IsAdmin { get; set; }
}
