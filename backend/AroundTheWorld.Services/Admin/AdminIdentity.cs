using AroundTheWorld.Abstractions.Services.Admin;
using AroundTheWorld.Services.Configuration;
using Microsoft.Extensions.Options;

namespace AroundTheWorld.Services.Admin;

public class AdminIdentity(IOptions<AdminOptions> options) : IAdminIdentity
{
    public bool IsAdmin(string? username)
    {
        var configured = options.Value.Username;

        // Fail closed. A blank configured name must make nobody an admin, never
        // everybody — and in particular must not match a blank or absent name.
        if (string.IsNullOrWhiteSpace(configured) || string.IsNullOrWhiteSpace(username))
        {
            return false;
        }

        return Normalise(username) == Normalise(configured);
    }

    /// <summary>
    /// Must stay identical to the normalisation <c>UsernameClaimService</c>
    /// stores in <c>UsernameNormalised</c>, or the admin name could be claimed
    /// by someone the game considers a different user.
    /// </summary>
    private static string Normalise(string value) => value.Trim().ToLowerInvariant();
}
