using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Database;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services;

public class ChannelVisitService(AppDbContext dbContext, TimeProvider timeProvider)
    : IChannelVisitService
{
    public async Task RecordAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new NotFoundException("Your session has expired — join again.");

        // First visit wins. Overwriting would make a second tap look like new
        // information, and nothing in the app is interested in the latest one.
        if (user.ChannelVisitedAt is not null)
        {
            return;
        }

        user.ChannelVisitedAt = timeProvider.GetUtcNow().UtcDateTime;
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
