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
}
