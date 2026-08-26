using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Database;
using AroundTheWorld.DomainModels.Models;
using AroundTheWorld.Services.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AroundTheWorld.Services;

public class GameService(
    AppDbContext dbContext,
    TimeProvider timeProvider,
    IOptions<GameOptions> gameOptions) : IGameService
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

            // Read per request rather than seeded, so switching the plug off is
            // an env var and a restart, not a database edit at 1am.
            YouTubeUrl = gameOptions.Value.YouTubeUrl?.Trim() ?? string.Empty,
        };

        state.Mode = state.ResolveMode(timeProvider.GetUtcNow().UtcDateTime);
        return state;
    }
}
