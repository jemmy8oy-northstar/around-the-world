namespace AroundTheWorld.Abstractions.Services;

/// <summary>
/// Records that a player tapped through to the YouTube channel, which is what
/// earns the badge beside their name in the feed.
/// </summary>
public interface IChannelVisitService
{
    /// <summary>
    /// Marks the visit. Idempotent, and keeps the FIRST visit's timestamp — the
    /// badge is not a counter, and re-tapping the link must not look like new
    /// information.
    /// </summary>
    Task RecordAsync(Guid userId, CancellationToken cancellationToken = default);
}
