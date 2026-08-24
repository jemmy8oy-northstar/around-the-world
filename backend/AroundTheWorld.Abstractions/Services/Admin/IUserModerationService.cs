namespace AroundTheWorld.Abstractions.Services.Admin;

public interface IUserModerationService
{
    /// <summary>Hides or unhides a user's posts from everyone but themselves.</summary>
    Task SetShadowBanAsync(string username, bool isShadowBanned, CancellationToken cancellationToken = default);

    /// <summary>
    /// Frees a claimed username so it can be taken again — the fix for someone
    /// whose phone died and who can no longer prove they are themselves.
    /// </summary>
    Task ReleaseUsernameAsync(string username, CancellationToken cancellationToken = default);
}
