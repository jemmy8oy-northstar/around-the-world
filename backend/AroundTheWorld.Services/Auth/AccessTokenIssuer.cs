using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Admin;
using AroundTheWorld.Abstractions.Services.Auth;
using AroundTheWorld.DomainModels.Models;
using AroundTheWorld.Services.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AroundTheWorld.Services.Auth;

public class AccessTokenIssuer(
    IOptions<JwtOptions> options,
    IAdminIdentity adminIdentity,
    TimeProvider timeProvider) : IAccessTokenIssuer
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
        List<Claim> claims =
        [
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.Username),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        ];

        // Admin is the opposite case to the shadow ban: the admin is meant to know,
        // and the claim is what lets the ordinary app session reach /admin routes
        // without a separate key. Stamped here rather than at the join, so a
        // refresh re-evaluates it — renaming the configured admin takes effect on
        // the next token instead of persisting for the life of a session.
        if (adminIdentity.IsAdmin(user.Username))
        {
            claims.Add(new Claim(AdminClaims.IsAdmin, AdminClaims.TrueValue));
        }

        var token = new JwtSecurityToken(
            issuer: settings.Issuer,
            audience: settings.Audience,
            claims: claims,
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
