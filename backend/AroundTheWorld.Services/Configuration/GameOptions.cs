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

    /// <summary>28 Aug 2026, 17:00 BST — the night of the pub crawl.</summary>
    public DateTime GoLiveAt { get; set; } = new(2026, 8, 28, 16, 0, 0, DateTimeKind.Utc);

    /// <summary>29 Aug 2026, 05:00 BST.</summary>
    public DateTime ReadOnlyAt { get; set; } = new(2026, 8, 29, 4, 0, 0, DateTimeKind.Utc);

    public string FirstRoundName { get; set; } = "Round 1";
}
