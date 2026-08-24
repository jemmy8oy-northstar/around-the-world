using AroundTheWorld.Abstractions.Services.Photos;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AroundTheWorld.WebApi.Routes;

public static class PhotoRoutes
{
    public static RouteGroupBuilder MapPhotoRoutes(this RouteGroupBuilder parentGroup)
    {
        var group = parentGroup.MapGroup("/photos").AllowAnonymous();

        group.MapGet("/{photoKey}", GetPhoto)
            .WithName("GetPhoto")
            .WithSummary("Serves a stored photo. Used when no public bucket URL is configured.")
            .ExcludeFromDescription();

        return parentGroup;
    }

    /// <summary>
    /// Anonymous, because these URLs sit in <c>img</c> tags that carry no
    /// Authorization header. The key is an unguessable GUID, which is the same
    /// protection a public bucket URL would have.
    /// </summary>
    private static async Task<Results<FileStreamHttpResult, NotFound>> GetPhoto(
        string photoKey,
        IPhotoStorage photoStorage,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var stream = await photoStorage.OpenAsync(photoKey, cancellationToken);

        if (stream is null)
        {
            return TypedResults.NotFound();
        }

        // Photos are immutable once written — the key is a fresh GUID every time —
        // so the browser never needs to revalidate.
        httpContext.Response.Headers.CacheControl = "public, max-age=31536000, immutable";

        return TypedResults.Stream(stream, ContentTypeFor(photoKey));
    }

    private static string ContentTypeFor(string photoKey) =>
        Path.GetExtension(photoKey).ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".heic" => "image/heic",
            _ => "image/jpeg",
        };
}
