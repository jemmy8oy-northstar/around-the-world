using AroundTheWorld.Abstractions.DataModels;
using AroundTheWorld.Abstractions.Enums;

namespace AroundTheWorld.DataModels.Models;

public class GameState : IGameState
{
    public GameMode Mode { get; set; }

    public int RoundId { get; set; }

    public required string RoundName { get; set; }

    public int CurrentStopNumber { get; set; }

    public DateTime GoLiveAt { get; set; }

    public DateTime ReadOnlyAt { get; set; }

    /// <summary>
    /// The birthday plug's link, or empty when it is switched off. It rides on
    /// this response because the join screen already fetches it anonymously —
    /// a second anonymous endpoint for one config string would be worse.
    /// </summary>
    public string YouTubeUrl { get; set; } = string.Empty;
}
