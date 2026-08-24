using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Database;
using AroundTheWorld.EntityModels.Entities;
using AroundTheWorld.Services.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AroundTheWorld.Services;

public class GameBootstrapper(
    AppDbContext dbContext,
    IOptions<GameOptions> options,
    IClock clock) : IGameBootstrapper
{
    public async Task EnsureInitialisedAsync(CancellationToken cancellationToken = default)
    {
        if (await dbContext.GameSettings.AnyAsync(cancellationToken))
        {
            // Already seeded. The admin page owns these values from here on, so
            // re-applying configuration would silently undo the developer's edits.
            return;
        }

        var settings = options.Value;

        var round = new RoundEntity
        {
            Name = settings.FirstRoundName,
            CurrentStopNumber = 1,
            StartedAt = clock.UtcNow,
        };

        dbContext.Rounds.Add(round);
        await dbContext.SaveChangesAsync(cancellationToken);

        dbContext.GameSettings.Add(new GameSettingsEntity
        {
            Id = 1,
            PartyCode = settings.PartyCode,
            GoLiveAt = settings.GoLiveAt,
            ReadOnlyAt = settings.ReadOnlyAt,
            ActiveRoundId = round.Id,
        });

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
