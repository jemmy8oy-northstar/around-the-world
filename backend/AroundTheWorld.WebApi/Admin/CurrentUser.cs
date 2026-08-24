using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using AroundTheWorld.Abstractions.Exceptions;

namespace AroundTheWorld.WebApi.Admin;

/// <summary>
/// Reads the authenticated user's id off the token. Lives in the WebApi because
/// claims are an HTTP concern — services receive a plain <see cref="Guid"/>.
/// </summary>
public static class CurrentUser
{
    public static Guid IdFrom(ClaimsPrincipal principal)
    {
        var subject = principal.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? principal.FindFirstValue(ClaimTypes.NameIdentifier);

        return Guid.TryParse(subject, out var userId)
            ? userId
            : throw new UnauthorizedException("Your session has expired — join again.");
    }
}
