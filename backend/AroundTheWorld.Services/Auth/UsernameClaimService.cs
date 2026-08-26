using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Auth;
using AroundTheWorld.Database;
using AroundTheWorld.DomainModels.Models;
using AroundTheWorld.EntityModels.Entities;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Auth;

public class UsernameClaimService(AppDbContext dbContext, TimeProvider timeProvider) : IUsernameClaimService
{
    public async Task<IDomainUser> ClaimAsync(string username, CancellationToken cancellationToken = default)
    {
        // Length, characters and normalisation are shared with the admin's rename
        // path — see UsernameRules. Two copies would drift.
        var trimmed = UsernameRules.Clean(username);
        var normalised = UsernameRules.Normalise(trimmed);

        var alreadyClaimed = await dbContext.Users.AnyAsync(
            u => u.UsernameNormalised == normalised && u.ReleasedAt == null, cancellationToken);

        if (alreadyClaimed)
        {
            // Deliberately not "log them in as that user": the feed's whole value is
            // that a post attributed to someone was made by them. An admin releases
            // the name when someone genuinely changes phone.
            throw new ConflictException($"\"{trimmed}\" is already taken — pick another name.");
        }

        var user = new UserEntity
        {
            Id = Guid.NewGuid(),
            Username = trimmed,
            UsernameNormalised = normalised,
            CreatedAt = timeProvider.GetUtcNow().UtcDateTime,
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new DomainUser
        {
            Id = user.Id,
            Username = user.Username,
            IsShadowBanned = user.IsShadowBanned,
        };
    }
}
