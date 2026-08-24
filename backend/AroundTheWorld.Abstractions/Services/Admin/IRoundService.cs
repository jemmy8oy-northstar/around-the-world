namespace AroundTheWorld.Abstractions.Services.Admin;

public interface IRoundService
{
    /// <summary>
    /// The reset: closes the active round and opens a new one. Nothing is deleted —
    /// the previous round's posts stay in the database, just out of the feed.
    /// </summary>
    Task<int> StartNewRoundAsync(string? name = null, CancellationToken cancellationToken = default);
}
