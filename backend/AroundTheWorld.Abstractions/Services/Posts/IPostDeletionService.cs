namespace AroundTheWorld.Abstractions.Services.Posts;

public interface IPostDeletionService
{
    /// <summary>
    /// Soft-deletes a post. A non-admin may only delete their own. The stored
    /// photo is deliberately left in place.
    /// </summary>
    Task DeleteAsync(
        Guid postId,
        Guid requestedByUserId,
        bool isAdmin,
        CancellationToken cancellationToken = default);
}
