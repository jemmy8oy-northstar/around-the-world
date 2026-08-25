using AroundTheWorld.Abstractions.Enums;

namespace AroundTheWorld.Tests;

/// <summary>
/// Deserialisation target for /api/game. Declared here rather than referencing the
/// DataModel so the tests assert against the wire contract the frontend actually
/// consumes, and a rename on the server surfaces as a failing test.
/// </summary>
public sealed class GameStateResponse
{
    public GameMode Mode { get; set; }

    public int RoundId { get; set; }

    public string RoundName { get; set; } = string.Empty;

    public int CurrentStopNumber { get; set; }

    public DateTime GoLiveAt { get; set; }

    public DateTime ReadOnlyAt { get; set; }
}
