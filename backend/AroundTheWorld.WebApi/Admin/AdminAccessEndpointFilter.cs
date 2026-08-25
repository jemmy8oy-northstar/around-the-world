using System.Security.Cryptography;
using System.Text;
using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Services.Configuration;
using Microsoft.Extensions.Options;

namespace AroundTheWorld.WebApi.Admin;

/// <summary>
/// Gates the admin route group. There are two ways in, and both are deliberate:
/// <list type="number">
/// <item>the signed-in admin's own token, which is what makes the admin tab work
/// from the phone they are already using; and</item>
/// <item>a shared secret sent as <c>X-Admin-Key</c>, kept as break-glass for the
/// night the admin's phone dies and the name is already claimed.</item>
/// </list>
/// Applied as a filter rather than checked in each handler so a new admin route
/// cannot accidentally ship unprotected.
/// </summary>
public class AdminAccessEndpointFilter(IOptions<AdminOptions> options) : IEndpointFilter
{
    public const string HeaderName = "X-Admin-Key";

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        // The group is AllowAnonymous, but UseAuthentication still runs the bearer
        // handler and populates HttpContext.User, so a valid admin token is
        // readable here without the endpoint requiring authorization at all.
        if (CurrentUser.IsAdmin(context.HttpContext.User))
        {
            return await next(context);
        }

        var configuredKey = options.Value.Key;

        if (string.IsNullOrWhiteSpace(configuredKey))
        {
            // Fail closed on the key path. An unset key must close that door, not
            // open it — but it must not close the admin's own token, which is why
            // this check sits after the claim check rather than before it.
            throw new ForbiddenException("Admin access is not configured.");
        }

        var supplied = context.HttpContext.Request.Headers[HeaderName].ToString();

        if (!FixedTimeEquals(supplied, configuredKey))
        {
            throw new ForbiddenException("Not for you.");
        }

        return await next(context);
    }

    /// <summary>
    /// Constant-time comparison so the response time doesn't reveal how much of a
    /// guessed key was correct.
    /// </summary>
    private static bool FixedTimeEquals(string left, string right) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(left), Encoding.UTF8.GetBytes(right));
}
