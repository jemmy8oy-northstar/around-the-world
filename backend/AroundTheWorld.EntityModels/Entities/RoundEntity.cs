namespace AroundTheWorld.EntityModels.Entities;

/// <summary>
/// One playthrough of the game. A "reset" ends the active round and starts a new
/// one rather than deleting anything, so every post stays attributable to the
/// night it was made on.
/// </summary>
public class RoundEntity
{
    public int Id { get; set; }

    public required string Name { get; set; }

    /// <summary>The pub stop the group is currently on. Advanced by the admin.</summary>
    public int CurrentStopNumber { get; set; } = 1;

    public DateTime StartedAt { get; set; }

    /// <summary>Null while this round is the active one.</summary>
    public DateTime? EndedAt { get; set; }

    public ICollection<PostEntity> Posts { get; set; } = [];
}
