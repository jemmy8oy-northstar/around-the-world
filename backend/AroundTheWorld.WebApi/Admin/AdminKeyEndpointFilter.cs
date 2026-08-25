using System.Security.Cryptography;
using System.Text;
using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Services.Configuration;
using Microsoft.Extensions.Options;

namespace AroundTheWorld.WebApi.Admin;

/// <summary>
/// Gates the admin route group on a shared secret sent as <c>X-Admin-Key</c>.
/// Applied as a filter rather than checked in each handler so a new admin route
/// cannot accidentally ship unprotected.
/// </summary>
public class AdminKeyEndpointFilter(IOptions<AdminOptions> options) : IEndpointFilter
{
    public const string HeaderName = "X-Admin-Key";

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var configuredKey = options.Value.Key;

        if (string.IsNullOrWhiteSpace(configuredKey))
        {
            // Fail closed. An unset key must lock the admin surface, never open it.
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
