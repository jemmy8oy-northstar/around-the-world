using AroundTheWorld.Abstractions.Enums;

namespace AroundTheWorld.Abstractions.DataModels;

public interface IGameState
{
    GameMode Mode { get; set; }

    int RoundId { get; set; }

    string RoundName { get; set; }

    int CurrentStopNumber { get; set; }

    DateTime GoLiveAt { get; set; }

    DateTime ReadOnlyAt { get; set; }
}
