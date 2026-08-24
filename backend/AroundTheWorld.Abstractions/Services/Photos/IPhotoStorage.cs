namespace AroundTheWorld.Abstractions.Services.Photos;

/// <summary>
/// Where drink photos live. Abstracted so the app runs locally and in CI with no
/// cloud credentials at all — see <c>FileSystemPhotoStorage</c>.
/// </summary>
public interface IPhotoStorage
{
    /// <summary>Stores the image and returns the opaque key it can be fetched by.</summary>
    Task<string> SaveAsync(Stream content, string contentType, CancellationToken cancellationToken = default);

    /// <summary>
    /// The URL a browser should load this photo from. May point straight at a
    /// public bucket, or back at this API when no public base URL is configured.
    /// </summary>
    string ResolveUrl(string photoKey);

    /// <summary>Opens the stored image, or null when the key is unknown.</summary>
    Task<Stream?> OpenAsync(string photoKey, CancellationToken cancellationToken = default);
}
