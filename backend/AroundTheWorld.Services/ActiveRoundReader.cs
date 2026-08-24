using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Database;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services;

public class ActiveRoundReader(AppDbContext dbContext) : IActiveRoundReader
{
    public async Task<int> GetActiveRoundIdAsync(CancellationToken cancellationToken = default)
    {
        var roundId = await dbContext.GameSettings
            .AsNoTracking()
            .Select(s => (int?)s.ActiveRoundId)
            .FirstOrDefaultAsync(cancellationToken);

        return roundId ?? throw new NotFoundException("The game has not been initialised.");
    }
}
