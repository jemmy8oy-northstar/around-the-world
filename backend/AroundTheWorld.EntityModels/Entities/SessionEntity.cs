namespace AroundTheWorld.EntityModels.Entities;

/// <summary>
/// A device's long-lived hold on a username. The refresh token is stored hashed
/// and rotated on every use, so a leaked database row cannot be replayed.
/// </summary>
public class SessionEntity
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public UserEntity? User { get; set; }

    /// <summary>SHA-256 of the opaque refresh token. The token itself is never stored.</summary>
    public required string RefreshTokenHash { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime ExpiresAt { get; set; }

    /// <summary>Set when the token is rotated or the username is released by an admin.</summary>
    public DateTime? RevokedAt { get; set; }
}
