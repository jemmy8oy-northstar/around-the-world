using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services.Admin;
using AroundTheWorld.Database;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Admin;

public class PubStopService(AppDbContext dbContext, TimeProvider timeProvider) : IPubStopService
{
    /// <summary>
    /// James asked for "at least a 5 min gap between pub progression". What it
    /// really guards is a mis-tap in a dark pub: there is no way to undo an
    /// advance short of restarting the whole round, so an accidental second tap
    /// is both expensive and silent — the number just reads one higher and
    /// everyone's posts land under the wrong stop for the rest of the night.
    /// </summary>
    public static readonly TimeSpan Cooldown = TimeSpan.FromMinutes(5);

    public async Task<int> AdvanceAsync(bool force = false, CancellationToken cancellationToken = default)
    {
        var round = await dbContext.Rounds.FirstOrDefaultAsync(r => r.EndedAt == null, cancellationToken)
            ?? throw new NotFoundException("There is no round in progress.");

        var now = timeProvider.GetUtcNow().UtcDateTime;

        // Refused rather than silently ignored, and overridable rather than
        // absolute. A hard block would be the one failure worse than the
        // double-tap: stranded at the wrong stop, mid-crawl, with no undo and no
        // way through. So the guard costs a confirmation, never the evening.
        if (!force && round.LastStopAdvancedAt is { } lastAdvancedAt && now - lastAdvancedAt < Cooldown)
        {
            throw new ConflictException(
                $"You moved to stop {round.CurrentStopNumber} {Ago(now - lastAdvancedAt)}. " +
                $"Move on to stop {round.CurrentStopNumber + 1} anyway?");
        }

        round.CurrentStopNumber++;
        round.LastStopAdvancedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);

        return round.CurrentStopNumber;
    }

    /// <summary>
    /// Rounded down to whole minutes, because the point of the sentence is to let
    /// him recognise his own last tap. "4 minutes ago" does that; "3 minutes and
    /// 47 seconds ago" is a worse thing to read in a pub.
    /// </summary>
    private static string Ago(TimeSpan elapsed)
    {
        var minutes = (int)elapsed.TotalMinutes;

        return minutes switch
        {
            // Also covers a negative elapsed time, which means the clock moved
            // backwards. Rare, but "in -2 minutes" is not a sentence.
            <= 0 => "less than a minute ago",
            1 => "a minute ago",
            _ => $"{minutes} minutes ago",
        };
    }
}
