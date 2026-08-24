using AroundTheWorld.Abstractions.DomainModels;

namespace AroundTheWorld.Abstractions.Services.Posts;

public interface IPostCreationService
{
    /// <summary>
    /// Stores the photo and records the drink against the active round and the
    /// pub stop the group is currently on.
    /// </summary>
    Task<IDomainPost> CreateAsync(
        Guid userId,
        Stream photo,
        string contentType,
        long lengthInBytes,
        string caption,
        string countryCode,
        CancellationToken cancellationToken = default);
}
