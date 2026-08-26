using System.Text.RegularExpressions;
using AroundTheWorld.Abstractions.Exceptions;

namespace AroundTheWorld.Services.Auth;

/// <summary>
/// The rules a username must satisfy, in one place.
/// <para>
/// Extracted when the admin gained the ability to rename someone: the rename
/// path needs exactly the rules the claim path enforces, and two copies of
/// "2–32 characters, letters/numbers/spaces/hyphens/underscores" would drift the
/// first time one of them was edited — leaving a name reachable by rename that
/// nobody could have claimed.
/// </para>
/// </summary>
public static partial class UsernameRules
{
    public const int MinimumLength = 2;
    public const int MaximumLength = 32;

    /// <summary>
    /// The lower-cased form backing the uniqueness index. Must stay identical to
    /// <c>AdminIdentity</c>'s normalisation, or the host's name could be claimed
    /// by someone the game considers a different user.
    /// </summary>
    public static string Normalise(string? username) =>
        (username ?? string.Empty).Trim().ToLowerInvariant();

    /// <summary>
    /// Validates and returns the name as it should be stored — trimmed, with the
    /// casing the user chose preserved.
    /// </summary>
    /// <exception cref="ValidationException">The name is unusable.</exception>
    public static string Clean(string? username)
    {
        var trimmed = (username ?? string.Empty).Trim();

        if (trimmed.Length is < MinimumLength or > MaximumLength)
        {
            throw new ValidationException($"Pick a name between {MinimumLength} and {MaximumLength} characters.");
        }

        if (!Allowed().IsMatch(trimmed))
        {
            throw new ValidationException("Names can use letters, numbers, spaces, hyphens and underscores.");
        }

        return trimmed;
    }

    [GeneratedRegex(@"^[\p{L}\p{N} _-]+$")]
    private static partial Regex Allowed();
}
