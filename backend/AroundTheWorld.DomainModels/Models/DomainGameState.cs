using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Enums;
using AroundTheWorld.DataModels.Models;

namespace AroundTheWorld.DomainModels.Models;

/// <summary>
/// The game-mode state machine. Both boundaries are inclusive-from: the instant
/// <c>GoLiveAt</c> arrives the game is Live, and the instant <c>ReadOnlyAt</c>
/// arrives it is Finished.
/// </summary>
public class DomainGameState : GameState, IDomainGameState
{
    public GameMode ResolveMode(DateTime utcNow)
    {
        if (utcNow >= ReadOnlyAt)
        {
            return GameMode.Finished;
        }

        return utcNow >= GoLiveAt ? GameMode.Live : GameMode.Practice;
    }

    /// <summary>
    /// Practice mode allows posting on purpose — the build week needs the app
    /// fully usable before the real event starts.
    /// </summary>
    public bool AllowsPosting(DateTime utcNow) => ResolveMode(utcNow) != GameMode.Finished;
}
