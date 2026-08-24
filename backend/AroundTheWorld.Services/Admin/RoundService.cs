using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Admin;
using AroundTheWorld.Database;
using AroundTheWorld.EntityModels.Entities;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Admin;

public class RoundService(AppDbContext dbContext, TimeProvider timeProvider) : IRoundService
{
    public async Task<int> StartNewRoundAsync(string? name = null, CancellationToken cancellationToken = default)
    {
        var settings = await dbContext.GameSettings.FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("The game has not been initialised.");

        var current = await dbContext.Rounds.FirstOrDefaultAsync(r => r.EndedAt == null, cancellationToken);
        var roundNumber = await dbContext.Rounds.CountAsync(cancellationToken) + 1;

        // Closing the old round and opening the new one in a single SaveChanges
        // keeps the partial unique index on Rounds(EndedAt) satisfied throughout —
        // there is never an instant with two open rounds or none.
        if (current is not null)
        {
            current.EndedAt = timeProvider.GetUtcNow().UtcDateTime;
        }

        var next = new RoundEntity
        {
            Name = string.IsNullOrWhiteSpace(name) ? $"Round {roundNumber}" : name.Trim(),
            CurrentStopNumber = 1,
            StartedAt = timeProvider.GetUtcNow().UtcDateTime,
        };

        dbContext.Rounds.Add(next);
        await dbContext.SaveChangesAsync(cancellationToken);

        settings.ActiveRoundId = next.Id;
        await dbContext.SaveChangesAsync(cancellationToken);

        return next.Id;
    }
}
