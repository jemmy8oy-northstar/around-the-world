using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Database;
using AroundTheWorld.DomainModels.Models;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services;

public class GameService(AppDbContext dbContext, TimeProvider timeProvider) : IGameService
{
    public async Task<IDomainGameState> GetStateAsync(CancellationToken cancellationToken = default)
    {
        var settings = await dbContext.GameSettings
            .AsNoTracking()
            .Include(s => s.ActiveRound)
            .FirstOrDefaultAsync(cancellationToken);

        if (settings?.ActiveRound is null)
        {
            throw new NotFoundException("The game has not been initialised.");
        }

        var state = new DomainGameState
        {
            RoundId = settings.ActiveRound.Id,
            RoundName = settings.ActiveRound.Name,
            CurrentStopNumber = settings.ActiveRound.CurrentStopNumber,
            GoLiveAt = settings.GoLiveAt,
            ReadOnlyAt = settings.ReadOnlyAt,
        };

        state.Mode = state.ResolveMode(timeProvider.GetUtcNow().UtcDateTime);
        return state;
    }
}
