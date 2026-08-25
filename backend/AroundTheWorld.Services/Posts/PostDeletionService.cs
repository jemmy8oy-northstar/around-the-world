using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services.Posts;
using AroundTheWorld.Database;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Posts;

public class PostDeletionService(AppDbContext dbContext) : IPostDeletionService
{
    public async Task DeleteAsync(
        Guid postId,
        Guid requestedByUserId,
        bool isAdmin,
        CancellationToken cancellationToken = default)
    {
        var post = await dbContext.Posts.FirstOrDefaultAsync(p => p.Id == postId, cancellationToken)
            ?? throw new NotFoundException("That post no longer exists.");

        if (!isAdmin && post.UserId != requestedByUserId)
        {
            throw new ForbiddenException("You can only delete your own posts.");
        }

        // Idempotent: deleting an already-deleted post is a no-op rather than an
        // error, because a flaky pub connection makes a double-tap likely.
        if (post.IsDeleted)
        {
            return;
        }

        // The only delete in the system. The stored photo is deliberately left in
        // place — see docs/spec.md §2.
        post.IsDeleted = true;
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
