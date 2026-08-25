namespace AroundTheWorld.Abstractions.Services.Admin;

/// <summary>
/// Decides whether a claimed username is the admin. One place, so the token
/// issuer, the session response and any future check cannot drift apart.
/// </summary>
public interface IAdminIdentity
{
    bool IsAdmin(string? username);
}
