using AroundTheWorld.Abstractions.DomainModels;

namespace AroundTheWorld.Abstractions.Services.Auth;

/// <summary>The two ways a device gets a usable token pair.</summary>
public interface IAuthService
{
    /// <summary>
    /// Claim the username and issue a session. The party code is optional and is
    /// only consulted when the name being claimed is the host's — see AuthService.
    /// </summary>
    Task<IDomainAuthSession> JoinAsync(string? partyCode, string username, CancellationToken cancellationToken = default);

    /// <summary>Redeem a refresh token for a fresh pair, revoking the one presented.</summary>
    Task<IDomainAuthSession> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default);
}
