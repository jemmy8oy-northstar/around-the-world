using AroundTheWorld.Abstractions.DomainModels;

namespace AroundTheWorld.Abstractions.Services.Posts;

public interface IPostFeedService
{
    /// <summary>
    /// The active round's posts, newest first, with shadow-banned authors hidden
    /// from everyone but themselves.
    /// </summary>
    Task<IReadOnlyList<IDomainPost>> GetFeedAsync(
        Guid viewerId,
        string? countryCode = null,
        CancellationToken cancellationToken = default);
}
