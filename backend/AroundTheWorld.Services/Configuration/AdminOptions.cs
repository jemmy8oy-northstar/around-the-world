namespace AroundTheWorld.Services.Configuration;

public class AdminOptions
{
    public const string SectionName = "Admin";

    /// <summary>
    /// The username that owns the admin tab. Matched case-insensitively using
    /// the same normalisation <c>UsernameClaimService</c> stores, so "James"
    /// and "james" are the same person.
    /// </summary>
    public string Username { get; set; } = "james";

    /// <summary>
    /// Shared secret for the hidden admin page, sent as an <c>X-Admin-Key</c>
    /// header. Supplied as a secret — never committed. Kept alongside
    /// <see cref="Username"/> as break-glass: if the admin's phone dies mid-crawl
    /// this is the only remaining way into the controls.
    /// </summary>
    public string Key { get; set; } = string.Empty;
}
