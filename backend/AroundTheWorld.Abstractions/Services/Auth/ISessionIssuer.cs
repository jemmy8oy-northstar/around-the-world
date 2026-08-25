using AroundTheWorld.Abstractions.DomainModels;

namespace AroundTheWorld.Abstractions.Services.Auth;

public interface ISessionIssuer
{
    /// <summary>Mints an access/refresh pair and persists the hashed refresh token.</summary>
    Task<IDomainAuthSession> IssueAsync(IDomainUser user, CancellationToken cancellationToken = default);
}
