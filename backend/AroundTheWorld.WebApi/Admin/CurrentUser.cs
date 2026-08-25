using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services.Admin;

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

    /// <summary>
    /// Whether the caller's token carries the admin marker. Returns false rather
    /// than throwing for an anonymous caller: the admin routes accept a shared
    /// key too, so "no token" is a normal way to arrive, not an error.
    /// </summary>
    public static bool IsAdmin(ClaimsPrincipal? principal) =>
        principal?.HasClaim(AdminClaims.IsAdmin, AdminClaims.TrueValue) == true;
}
