namespace AroundTheWorld.EntityModels.Entities;

/// <summary>
/// Singleton configuration row (always <c>Id = 1</c>) holding the party code and
/// the two instants that drive the game-mode state machine. Editable from the
/// admin page so a mistimed cutover is a tap rather than a redeploy.
/// </summary>
public class GameSettingsEntity
{
    public int Id { get; set; } = 1;

    public required string PartyCode { get; set; }

    /// <summary>Before this instant the game is in practice mode.</summary>
    public DateTime GoLiveAt { get; set; }

    /// <summary>At and after this instant the game is read-only forever.</summary>
    public DateTime ReadOnlyAt { get; set; }

    public int ActiveRoundId { get; set; }

    public RoundEntity? ActiveRound { get; set; }
}
