using AroundTheWorld.Abstractions.DomainModels;

namespace AroundTheWorld.Abstractions.Services;

public interface IGameService
{
    /// <summary>
    /// The active round, current pub stop, cutover instants, and the mode those
    /// instants resolve to right now.
    /// </summary>
    Task<IDomainGameState> GetStateAsync(CancellationToken cancellationToken = default);
}
