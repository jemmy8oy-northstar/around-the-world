using AroundTheWorld.Abstractions.Services.Photos;

namespace AroundTheWorld.Services.Photos;

/// <summary>
/// Builds the opaque storage key for a new photo. Kept separate so both storage
/// implementations name objects identically and a key stays valid if the backing
/// store is swapped.
/// </summary>
public class PhotoKeyFactory : IPhotoKeyFactory
{
    private static readonly Dictionary<string, string> ExtensionsByMediaType = new()
    {
        ["image/jpeg"] = "jpg",
        ["image/png"] = "png",
        ["image/webp"] = "webp",
        ["image/heic"] = "heic",
    };

    /// <summary>
    /// A bare GUID plus an extension — no username, round or timestamp. The key
    /// ends up in a public URL, so it must not leak who posted what or let anyone
    /// enumerate the bucket by guessing.
    /// </summary>
    public string Create(string contentType)
    {
        var mediaType = (contentType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant();
        var extension = ExtensionsByMediaType.GetValueOrDefault(mediaType, "jpg");

        return $"{Guid.NewGuid():N}.{extension}";
    }
}
