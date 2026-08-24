using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Auth;
using AroundTheWorld.Database;
using AroundTheWorld.DomainModels.Models;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Auth;

public class RefreshTokenRedeemer(
    AppDbContext dbContext,
    IRefreshTokenFactory refreshTokenFactory,
    IClock clock) : IRefreshTokenRedeemer
{
    public async Task<IDomainUser> RedeemAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            throw new UnauthorizedException("Your session has expired — join again.");
        }

        var hash = refreshTokenFactory.Hash(refreshToken);

        var session = await dbContext.Sessions
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.RefreshTokenHash == hash, cancellationToken);

        // One message for unknown, revoked and expired alike — a caller probing
        // tokens learns nothing from the response about which it was.
        if (session?.User is null || session.RevokedAt is not null || session.ExpiresAt <= clock.UtcNow)
        {
            throw new UnauthorizedException("Your session has expired — join again.");
        }

        // Single-use: revoked as it is consumed, so a token captured in transit is
        // worthless the moment the real device refreshes.
        session.RevokedAt = clock.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return new DomainUser
        {
            Id = session.User.Id,
            Username = session.User.Username,
            IsShadowBanned = session.User.IsShadowBanned,
        };
    }
}
