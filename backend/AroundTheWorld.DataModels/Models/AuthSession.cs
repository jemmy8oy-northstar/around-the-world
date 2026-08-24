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
}
