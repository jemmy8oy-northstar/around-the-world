namespace AroundTheWorld.Abstractions.Services.Admin;

/// <summary>
/// The admin marker carried on the access token.
/// </summary>
public static class AdminClaims
{
    /// <summary>
    /// A private claim name rather than <c>ClaimTypes.Role</c> on purpose:
    /// JwtSecurityTokenHandler rewrites well-known claim types through its
    /// inbound and outbound maps, so a role round-trips through two renames
    /// before anything reads it. An unmapped name passes through untouched, and
    /// what is written is exactly what is read.
    /// </summary>
    public const string IsAdmin = "atw_admin";

    public const string TrueValue = "true";
}
