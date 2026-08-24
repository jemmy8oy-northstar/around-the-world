namespace AroundTheWorld.Services.Configuration;

/// <summary>
/// Seed values for a fresh database, bound from the <c>Game</c> configuration
/// section. These are only ever applied once — after the first run the admin
/// page is the source of truth, so changing them here has no effect on an
/// existing database.
/// </summary>
public class GameOptions
{
    public const string SectionName = "Game";

    /// <summary>The shared code friends type to get in.</summary>
    public string PartyCode { get; set; } = "260802";

    /// <summary>26 Aug 2026, 17:00 BST.</summary>
    public DateTime GoLiveAt { get; set; } = new(2026, 8, 26, 16, 0, 0, DateTimeKind.Utc);

    /// <summary>27 Aug 2026, 05:00 BST.</summary>
    public DateTime ReadOnlyAt { get; set; } = new(2026, 8, 27, 4, 0, 0, DateTimeKind.Utc);

    public string FirstRoundName { get; set; } = "Round 1";
}
