using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Auth;
using AroundTheWorld.Database;
using AroundTheWorld.DomainModels.Models;
using AroundTheWorld.EntityModels.Entities;
using AroundTheWorld.Services.Configuration;
using Microsoft.Extensions.Options;

namespace AroundTheWorld.Services.Auth;

public class SessionIssuer(
    AppDbContext dbContext,
    IAccessTokenIssuer accessTokenIssuer,
    IRefreshTokenFactory refreshTokenFactory,
    IOptions<JwtOptions> options,
    TimeProvider timeProvider) : ISessionIssuer
{
    public async Task<IDomainAuthSession> IssueAsync(IDomainUser user, CancellationToken cancellationToken = default)
    {
        var accessToken = accessTokenIssuer.Issue(user);
        var refreshToken = refreshTokenFactory.Generate();

        dbContext.Sessions.Add(new SessionEntity
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            RefreshTokenHash = refreshTokenFactory.Hash(refreshToken),
            CreatedAt = timeProvider.GetUtcNow().UtcDateTime,
            ExpiresAt = timeProvider.GetUtcNow().UtcDateTime.AddDays(options.Value.RefreshTokenDays),
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return new DomainAuthSession
        {
            AccessToken = accessToken.Value,
            AccessTokenExpiresAt = accessToken.ExpiresAt,
            RefreshToken = refreshToken,
            UserId = user.Id,
            Username = user.Username,
        };
    }
}
