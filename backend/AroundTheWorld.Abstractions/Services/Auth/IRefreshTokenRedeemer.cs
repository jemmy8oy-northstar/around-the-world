using AroundTheWorld.Abstractions.DomainModels;

namespace AroundTheWorld.Abstractions.Services.Auth;

public interface IRefreshTokenRedeemer
{
    /// <summary>
    /// Consumes a refresh token — revoking it so it cannot be replayed — and
    /// returns its owner. Throws when the token is unknown, expired or already used.
    /// </summary>
    Task<IDomainUser> RedeemAsync(string refreshToken, CancellationToken cancellationToken = default);
}
