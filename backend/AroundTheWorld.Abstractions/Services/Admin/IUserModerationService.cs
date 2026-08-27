namespace AroundTheWorld.Abstractions.Services.Admin;

public interface IUserModerationService
{
    /// <summary>Hides or unhides a user's posts from everyone but themselves.</summary>
    Task SetShadowBanAsync(string username, bool isShadowBanned, CancellationToken cancellationToken = default);

    /// <summary>
    /// The usernames currently shadow-banned. Exists so the admin UI can mark a
    /// hidden post without the ban state ever being added to the post wire model,
    /// where a banned user would be able to read it about themselves.
    /// </summary>
    Task<IReadOnlyList<string>> GetShadowBannedAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Frees a claimed username so it can be taken again — the fix for someone
    /// whose phone died and who can no longer prove they are themselves.
    /// </summary>
    Task ReleaseUsernameAsync(string username, CancellationToken cancellationToken = default);

    /// <summary>
    /// Renames a player in place, keeping their identity, their session and every
    /// post they have already made. Unlike a release-and-reclaim, they never lose
    /// their place in the game — which is the point, since the reason to rename
    /// someone at 11pm is that the name is rude, not that they lost their phone.
    /// </summary>
    /// <returns>The new name as stored, with its chosen casing.</returns>
    Task<string> RenameAsync(string username, string newUsername, CancellationToken cancellationToken = default);
}
