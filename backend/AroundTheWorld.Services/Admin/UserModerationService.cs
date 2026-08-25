using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Admin;
using AroundTheWorld.Database;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Admin;

public class UserModerationService(AppDbContext dbContext, TimeProvider timeProvider) : IUserModerationService
{
    public async Task SetShadowBanAsync(
        string username,
        bool isShadowBanned,
        CancellationToken cancellationToken = default)
    {
        var user = await FindAsync(username, cancellationToken);

        user.IsShadowBanned = isShadowBanned;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<string>> GetShadowBannedAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Users
            .AsNoTracking()
            .Where(u => u.IsShadowBanned && u.ReleasedAt == null)
            .OrderBy(u => u.UsernameNormalised)
            .Select(u => u.Username)
            .ToListAsync(cancellationToken);

    public async Task ReleaseUsernameAsync(string username, CancellationToken cancellationToken = default)
    {
        var user = await FindAsync(username, cancellationToken);

        // Revoking the sessions rather than deleting the user keeps their existing
        // posts attributed, so releasing a name to a dead phone does not blank the
        // feed. The name is then free to claim again.
        var sessions = await dbContext.Sessions
            .Where(s => s.UserId == user.Id && s.RevokedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var session in sessions)
        {
            session.RevokedAt = timeProvider.GetUtcNow().UtcDateTime;
        }

        user.ReleasedAt = timeProvider.GetUtcNow().UtcDateTime;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<EntityModels.Entities.UserEntity> FindAsync(
        string username,
        CancellationToken cancellationToken)
    {
        var normalised = (username ?? string.Empty).Trim().ToLowerInvariant();

        return await dbContext.Users.FirstOrDefaultAsync(
                u => u.UsernameNormalised == normalised && u.ReleasedAt == null, cancellationToken)
            ?? throw new NotFoundException($"No one here is called \"{username}\".");
    }
}
