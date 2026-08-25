using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Auth;
using AroundTheWorld.DomainModels.Models;
using AroundTheWorld.Services.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AroundTheWorld.Services.Auth;

public class AccessTokenIssuer(IOptions<JwtOptions> options, TimeProvider timeProvider) : IAccessTokenIssuer
{
    public IDomainAccessToken Issue(IDomainUser user)
    {
        var settings = options.Value;
        var expiresAt = timeProvider.GetUtcNow().UtcDateTime.AddHours(settings.AccessTokenHours);

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.Secret)),
            SecurityAlgorithms.HmacSha256);

        // Shadow-ban state is deliberately absent from the token: it is server-side
        // filtering only, and a banned user must not be able to decode their own
        // token and discover it.
        var token = new JwtSecurityToken(
            issuer: settings.Issuer,
            audience: settings.Audience,
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            ],
            notBefore: timeProvider.GetUtcNow().UtcDateTime,
            expires: expiresAt,
            signingCredentials: credentials);

        return new DomainAccessToken
        {
            Value = new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAt = expiresAt,
        };
    }
}
