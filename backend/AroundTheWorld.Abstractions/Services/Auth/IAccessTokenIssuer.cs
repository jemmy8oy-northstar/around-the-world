using AroundTheWorld.Abstractions.DomainModels;

namespace AroundTheWorld.Abstractions.Services.Auth;

public interface IAccessTokenIssuer
{
    IDomainAccessToken Issue(IDomainUser user);
}
