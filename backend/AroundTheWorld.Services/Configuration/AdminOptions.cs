namespace AroundTheWorld.Services.Configuration;

public class AdminOptions
{
    public const string SectionName = "Admin";

    /// <summary>
    /// Shared secret for the hidden admin page, sent as an <c>X-Admin-Key</c>
    /// header. Supplied as a secret — never committed.
    /// </summary>
    public string Key { get; set; } = string.Empty;
}
