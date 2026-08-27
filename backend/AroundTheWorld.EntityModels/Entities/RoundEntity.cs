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

    /// <summary>
    /// When the stop was last advanced, so a mis-tap can be told from a real move
    /// to the next pub. Null on a fresh round: the first advance of the night has
    /// nothing to have double-tapped against, so it is never questioned.
    /// </summary>
    public DateTime? LastStopAdvancedAt { get; set; }

    public DateTime StartedAt { get; set; }

    /// <summary>Null while this round is the active one.</summary>
    public DateTime? EndedAt { get; set; }

    public ICollection<PostEntity> Posts { get; set; } = [];
}
