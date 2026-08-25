using AroundTheWorld.Abstractions.DomainModels;

namespace AroundTheWorld.Abstractions.Services.Posts;

public interface IPostFeedService
{
    /// <summary>
    /// The active round's posts, newest first, with shadow-banned authors hidden
    /// from everyone but themselves — and, when <paramref name="viewerIsAdmin"/>
    /// is set, from nobody, so the admin can still find a post they have hidden.
    /// </summary>
    Task<IReadOnlyList<IDomainPost>> GetFeedAsync(
        Guid viewerId,
        string? countryCode = null,
        bool viewerIsAdmin = false,
        CancellationToken cancellationToken = default);
}
