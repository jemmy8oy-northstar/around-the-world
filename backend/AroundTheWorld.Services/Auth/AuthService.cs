using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Services.Admin;
using AroundTheWorld.Abstractions.Services.Auth;

namespace AroundTheWorld.Services.Auth;

/// <summary>
/// Orchestrates the two auth journeys. Contains no logic of its own — every step
/// is a named single-responsibility service.
/// </summary>
public class AuthService(
    IPartyCodeValidator partyCodeValidator,
    IAdminIdentity adminIdentity,
    IUsernameClaimService usernameClaimService,
    IRefreshTokenRedeemer refreshTokenRedeemer,
    ISessionIssuer sessionIssuer) : IAuthService
{
    public async Task<IDomainAuthSession> JoinAsync(
        string? partyCode,
        string username,
        CancellationToken cancellationToken = default)
    {
        // The code no longer gates the party: a guest types a name and is in.
        //
        // It still gates exactly one name — the host's. Admin is granted by
        // USERNAME (see AdminIdentity), so with no gate at all anyone who
        // reached the URL could type the host's name and be handed the admin
        // claim with their session: delete any post, shadow ban anyone, move
        // the cutovers. The name is the credential, so the name keeps a lock.
        if (adminIdentity.IsAdmin(username))
        {
            await partyCodeValidator.ValidateAsync(partyCode, cancellationToken);
        }

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
