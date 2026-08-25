using AroundTheWorld.Abstractions.DomainModels;

namespace AroundTheWorld.Abstractions.Services.Auth;

public interface IUsernameClaimService
{
    /// <summary>
    /// Takes ownership of a username for a new device. Throws when the name is
    /// malformed or already claimed.
    /// </summary>
    Task<IDomainUser> ClaimAsync(string username, CancellationToken cancellationToken = default);
}
