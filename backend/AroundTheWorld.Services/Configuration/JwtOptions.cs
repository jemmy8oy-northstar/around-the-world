namespace AroundTheWorld.Services.Configuration;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>Signing key. Supplied as a secret — never committed.</summary>
    public string Secret { get; set; } = string.Empty;

    public string Issuer { get; set; } = "around-the-world";

    public string Audience { get; set; } = "around-the-world";

    /// <summary>
    /// Deliberately long. This is a one-night app used on phones with patchy pub
    /// wifi; a token that outlives the party removes a whole class of "why am I
    /// logged out" problems, and the refresh path still exists as a backstop.
    /// </summary>
    public int AccessTokenHours { get; set; } = 12;

    /// <summary>Long enough that the keepsake stays readable for months afterwards.</summary>
    public int RefreshTokenDays { get; set; } = 90;
}
