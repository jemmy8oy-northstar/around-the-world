using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Admin;
using AroundTheWorld.Database;
using AroundTheWorld.Services.Auth;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Admin;

public class UserModerationService(
    AppDbContext dbContext,
    TimeProvider timeProvider,
    IAdminIdentity adminIdentity) : IUserModerationService
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

    public async Task<string> RenameAsync(
        string username,
        string newUsername,
        CancellationToken cancellationToken = default)
    {
        var user = await FindAsync(username, cancellationToken);

        // Exactly the rules a player faces at the join screen. A name reachable
        // by rename that nobody could have claimed would be a hole in both.
        var cleaned = UsernameRules.Clean(newUsername);
        var normalised = UsernameRules.Normalise(cleaned);

        if (adminIdentity.IsAdmin(cleaned) && !adminIdentity.IsAdmin(user.Username))
        {
            // Admin is granted by USERNAME, so renaming someone into the host's
            // name hands them the admin panel at their next token refresh —
            // silently, and up to twelve hours later. The host claims that name
            // through the join screen with the host code, and only there.
            throw new ForbiddenException(
                $"\"{cleaned}\" is the host's name — renaming someone into it would make them an admin.");
        }

        if (normalised == user.UsernameNormalised)
        {
            // A casing-only change is a real edit ("dave" → "Dave") and must not
            // trip the uniqueness check against the user's own row.
            user.Username = cleaned;
            await dbContext.SaveChangesAsync(cancellationToken);
            return cleaned;
        }

        var taken = await dbContext.Users.AnyAsync(
            u => u.UsernameNormalised == normalised && u.ReleasedAt == null, cancellationToken);

        if (taken)
        {
            throw new ConflictException($"\"{cleaned}\" is already taken.");
        }

        // Their sessions are deliberately NOT revoked and their posts are not
        // touched: posts reference the user row, so the whole feed re-attributes
        // itself and the person carries on posting without noticing.
        user.Username = cleaned;
        user.UsernameNormalised = normalised;
        await dbContext.SaveChangesAsync(cancellationToken);

        return cleaned;
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
