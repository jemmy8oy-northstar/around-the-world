namespace AroundTheWorld.EntityModels.Entities;

/// <summary>
/// A friend who has claimed a username. There is no email, password or profile —
/// the party code is the gate and the username is the whole identity.
/// </summary>
public class UserEntity
{
    public Guid Id { get; set; }

    /// <summary>The name as typed, preserving the casing they chose.</summary>
    public required string Username { get; set; }

    /// <summary>
    /// Lower-cased form backing the uniqueness constraint, so "Dave" and "dave"
    /// cannot both be claimed.
    /// </summary>
    public required string UsernameNormalised { get; set; }

    /// <summary>
    /// When true this user's posts are hidden from everyone else's feed, map and
    /// leaderboard — but not from their own. They should not be able to tell.
    /// </summary>
    public bool IsShadowBanned { get; set; }

    /// <summary>
    /// Set when an admin frees the name for someone else to claim — typically
    /// because the original device died. The row is kept rather than deleted so
    /// their existing posts stay attributed.
    /// </summary>
    public DateTime? ReleasedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public ICollection<PostEntity> Posts { get; set; } = [];

    public ICollection<SessionEntity> Sessions { get; set; } = [];
}
