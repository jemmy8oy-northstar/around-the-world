using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Countries;
using AroundTheWorld.Abstractions.Services.Photos;
using AroundTheWorld.Abstractions.Services.Posts;
using AroundTheWorld.Database;
using AroundTheWorld.DomainModels.Models;
using AroundTheWorld.EntityModels.Entities;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Posts;

public class PostCreationService(
    AppDbContext dbContext,
    IGameService gameService,
    ICountryCatalogue countryCatalogue,
    IPhotoUploadValidator photoUploadValidator,
    IPhotoStorage photoStorage,
    TimeProvider timeProvider) : IPostCreationService
{
    private const int MaximumCaptionLength = 280;

    public async Task<IDomainPost> CreateAsync(
        Guid userId,
        Stream photo,
        string contentType,
        long lengthInBytes,
        string caption,
        string countryCode,
        CancellationToken cancellationToken = default)
    {
        var state = await gameService.GetStateAsync(cancellationToken);

        if (!state.AllowsPosting(timeProvider.GetUtcNow().UtcDateTime))
        {
            throw new ForbiddenException("That's a wrap — the game is finished.");
        }

        var normalisedCountry = countryCatalogue.Normalise(countryCode);
        var trimmedCaption = ValidateCaption(caption);
        photoUploadValidator.Validate(lengthInBytes, contentType);

        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
            ?? throw new NotFoundException("That account no longer exists.");

        // Stored before the row is written: a photo with no post is a harmless
        // orphan, whereas a post row pointing at a photo that failed to upload is
        // a permanently broken card in the feed.
        var photoKey = await photoStorage.SaveAsync(photo, contentType, cancellationToken);

        var post = new PostEntity
        {
            Id = Guid.NewGuid(),
            RoundId = state.RoundId,
            UserId = userId,
            PhotoKey = photoKey,
            Caption = trimmedCaption,
            CountryCode = normalisedCountry,

            // Stamped at creation rather than read live, so advancing the pub stop
            // never retroactively moves drinks between stops in the feed.
            StopNumber = state.CurrentStopNumber,
            CreatedAt = timeProvider.GetUtcNow().UtcDateTime,
        };

        dbContext.Posts.Add(post);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new DomainPost
        {
            Id = post.Id,
            UserId = userId,
            Username = user.Username,
            PhotoUrl = photoStorage.ResolveUrl(photoKey),
            Caption = post.Caption,
            CountryCode = post.CountryCode,
            StopNumber = post.StopNumber,
            CreatedAt = post.CreatedAt,
            AuthorIsShadowBanned = user.IsShadowBanned,
        };
    }

    private static string ValidateCaption(string caption)
    {
        var trimmed = (caption ?? string.Empty).Trim();

        return trimmed.Length > MaximumCaptionLength
            ? throw new ValidationException($"Keep the caption under {MaximumCaptionLength} characters.")
            : trimmed;
    }
}
