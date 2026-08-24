using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Posts;
using AroundTheWorld.Database;
using AroundTheWorld.DomainModels.Models;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Posts;

public class CountryTallyService(AppDbContext dbContext, IActiveRoundReader activeRoundReader)
    : ICountryTallyService
{
    public async Task<IReadOnlyList<IDomainCountryTally>> GetTallyAsync(
        Guid viewerId,
        CancellationToken cancellationToken = default)
    {
        var roundId = await activeRoundReader.GetActiveRoundIdAsync(cancellationToken);

        // Same visibility rule as the feed — otherwise a banned user's drinks would
        // still swell the map badge and give the ban away.
        var tallies = await dbContext.Posts
            .AsNoTracking()
            .Where(p => p.RoundId == roundId
                && !p.IsDeleted
                && (!p.User!.IsShadowBanned || p.UserId == viewerId))
            .GroupBy(p => p.CountryCode)
            .Select(g => new { CountryCode = g.Key, PostCount = g.Count() })
            .ToListAsync(cancellationToken);

        return tallies
            .OrderByDescending(t => t.PostCount)
            .ThenBy(t => t.CountryCode, StringComparer.Ordinal)
            .Select(t => (IDomainCountryTally)new DomainCountryTally
            {
                CountryCode = t.CountryCode,
                PostCount = t.PostCount,
            })
            .ToList();
    }
}
