using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services.Admin;
using AroundTheWorld.Database;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Admin;

public class GameSettingsService(AppDbContext dbContext) : IGameSettingsService
{
    public async Task UpdateCutoversAsync(
        DateTime goLiveAt,
        DateTime readOnlyAt,
        CancellationToken cancellationToken = default)
    {
        if (readOnlyAt <= goLiveAt)
        {
            throw new ValidationException("The read-only time has to be after the go-live time.");
        }

        var settings = await dbContext.GameSettings.FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("The game has not been initialised.");

        settings.GoLiveAt = goLiveAt.ToUniversalTime();
        settings.ReadOnlyAt = readOnlyAt.ToUniversalTime();

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
