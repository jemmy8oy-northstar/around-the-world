namespace AroundTheWorld.EntityModels.Entities;

/// <summary>
/// One drink: a photo, a caption, and the country the drink is from (not where
/// the drinker is — see docs/spec.md §1).
/// </summary>
public class PostEntity
{
    public Guid Id { get; set; }

    public int RoundId { get; set; }

    public RoundEntity? Round { get; set; }

    public Guid UserId { get; set; }

    public UserEntity? User { get; set; }

    /// <summary>Opaque storage key. The bucket layout never reaches the API contract.</summary>
    public required string PhotoKey { get; set; }

    public required string Caption { get; set; }

    /// <summary>ISO 3166-1 alpha-2, upper-cased.</summary>
    public required string CountryCode { get; set; }

    /// <summary>The pub stop the round was on when this was posted.</summary>
    public int StopNumber { get; set; }

    /// <summary>The only delete in the system. Set by the author or by an admin.</summary>
    public bool IsDeleted { get; set; }

    public DateTime CreatedAt { get; set; }
}
