using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services.Admin;
using AroundTheWorld.Database;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Admin;

public class PubStopService(AppDbContext dbContext) : IPubStopService
{
    public async Task<int> AdvanceAsync(CancellationToken cancellationToken = default)
    {
        var round = await dbContext.Rounds.FirstOrDefaultAsync(r => r.EndedAt == null, cancellationToken)
            ?? throw new NotFoundException("There is no round in progress.");

        round.CurrentStopNumber++;
        await dbContext.SaveChangesAsync(cancellationToken);

        return round.CurrentStopNumber;
    }
}
