using AroundTheWorld.Abstractions.DomainModels;

namespace AroundTheWorld.Abstractions.Services.Posts;

public interface ICountryTallyService
{
    /// <summary>
    /// Post counts per country for the active round, ranked highest first. Applies
    /// the same shadow-ban visibility rules as the feed.
    /// </summary>
    Task<IReadOnlyList<IDomainCountryTally>> GetTallyAsync(
        Guid viewerId,
        CancellationToken cancellationToken = default);
}
