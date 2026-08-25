using AroundTheWorld.Abstractions.Services.Photos;
using AroundTheWorld.Services.Configuration;
using Microsoft.Extensions.Options;

namespace AroundTheWorld.Services.Photos;

/// <summary>
/// On-disk fallback used whenever OCI Object Storage is not configured, so the
/// app is fully runnable — including photo upload and display — with no cloud
/// credentials. Not intended for multi-replica production use: the directory is
/// local to the pod.
/// </summary>
public class FileSystemPhotoStorage(IOptions<PhotoStorageOptions> options, IPhotoKeyFactory photoKeyFactory)
    : IPhotoStorage
{
    public async Task<string> SaveAsync(
        Stream content,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        var root = EnsureRoot();
        var key = photoKeyFactory.Create(contentType);

        await using var file = File.Create(Path.Combine(root, key));
        await content.CopyToAsync(file, cancellationToken);

        return key;
    }

    /// <summary>Served back through this API — there is no public URL for a local file.</summary>
    public string ResolveUrl(string photoKey) => $"/api/photos/{photoKey}";

    public Task<Stream?> OpenAsync(string photoKey, CancellationToken cancellationToken = default)
    {
        var path = ResolveSafePath(photoKey);

        return Task.FromResult<Stream?>(
            path is not null && File.Exists(path) ? File.OpenRead(path) : null);
    }

    private string EnsureRoot()
    {
        var root = Path.GetFullPath(options.Value.LocalRootPath);
        Directory.CreateDirectory(root);
        return root;
    }

    /// <summary>
    /// Resolves a key to a path and refuses anything that escapes the store.
    /// The key reaches this method straight off a URL, so "../../appsettings.json"
    /// is an expected input rather than a hypothetical one.
    /// </summary>
    private string? ResolveSafePath(string photoKey)
    {
        if (string.IsNullOrWhiteSpace(photoKey) || photoKey.Contains('/') || photoKey.Contains('\\'))
        {
            return null;
        }

        var root = EnsureRoot();
        var candidate = Path.GetFullPath(Path.Combine(root, photoKey));

        return candidate.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal)
            ? candidate
            : null;
    }
}
