using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Countries;
using AroundTheWorld.Abstractions.Services.Photos;
using AroundTheWorld.Abstractions.Services.Posts;
using AroundTheWorld.Database;
using AroundTheWorld.DomainModels.Models;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Posts;

public class PostFeedService(
    AppDbContext dbContext,
    IActiveRoundReader activeRoundReader,
    ICountryCatalogue countryCatalogue,
    IPhotoStorage photoStorage) : IPostFeedService
{
    public async Task<IReadOnlyList<IDomainPost>> GetFeedAsync(
        Guid viewerId,
        string? countryCode = null,
        bool viewerIsAdmin = false,
        CancellationToken cancellationToken = default)
    {
        var roundId = await activeRoundReader.GetActiveRoundIdAsync(cancellationToken);

        var query = dbContext.Posts
            .AsNoTracking()
            .Include(p => p.User)
            .Where(p => p.RoundId == roundId && !p.IsDeleted);

        if (!string.IsNullOrWhiteSpace(countryCode))
        {
            var normalised = countryCatalogue.Normalise(countryCode);
            query = query.Where(p => p.CountryCode == normalised);
        }

        // The shadow ban: hidden from everyone except the banned user, whose own
        // feed is unchanged so they cannot tell anything happened — and the admin,
        // because a ban you can no longer see is one you can no longer lift.
        if (!viewerIsAdmin)
        {
            query = query.Where(p => !p.User!.IsShadowBanned || p.UserId == viewerId);
        }

        var posts = await query
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);

        return posts.Select(p => (IDomainPost)new DomainPost
        {
            Id = p.Id,
            UserId = p.UserId,
            Username = p.User!.Username,
            PhotoUrl = photoStorage.ResolveUrl(p.PhotoKey),
            Caption = p.Caption,
            CountryCode = p.CountryCode,
            StopNumber = p.StopNumber,
            CreatedAt = p.CreatedAt,
            AuthorIsShadowBanned = p.User.IsShadowBanned,
        }).ToList();
    }
}
