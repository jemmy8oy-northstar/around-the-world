using AroundTheWorld.Abstractions.DataModels;
using AroundTheWorld.Abstractions.Enums;

namespace AroundTheWorld.Abstractions.DomainModels;

public interface IDomainGameState : IGameState
{
    /// <summary>Which phase the given instant falls into.</summary>
    GameMode ResolveMode(DateTime utcNow);

    /// <summary>Whether new posts are accepted at the given instant.</summary>
    bool AllowsPosting(DateTime utcNow);
}
