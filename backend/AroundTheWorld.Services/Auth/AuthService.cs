using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Services.Auth;

namespace AroundTheWorld.Services.Auth;

/// <summary>
/// Orchestrates the two auth journeys. Contains no logic of its own — every step
/// is a named single-responsibility service.
/// </summary>
public class AuthService(
    IPartyCodeValidator partyCodeValidator,
    IUsernameClaimService usernameClaimService,
    IRefreshTokenRedeemer refreshTokenRedeemer,
    ISessionIssuer sessionIssuer) : IAuthService
{
    public async Task<IDomainAuthSession> JoinAsync(
        string partyCode,
        string username,
        CancellationToken cancellationToken = default)
    {
        await partyCodeValidator.ValidateAsync(partyCode, cancellationToken);
        var user = await usernameClaimService.ClaimAsync(username, cancellationToken);
        return await sessionIssuer.IssueAsync(user, cancellationToken);
    }

    public async Task<IDomainAuthSession> RefreshAsync(
        string refreshToken,
        CancellationToken cancellationToken = default)
    {
        var user = await refreshTokenRedeemer.RedeemAsync(refreshToken, cancellationToken);
        return await sessionIssuer.IssueAsync(user, cancellationToken);
    }
}
