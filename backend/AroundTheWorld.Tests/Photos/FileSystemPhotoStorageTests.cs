using System.Text;
using AroundTheWorld.Services.Configuration;
using AroundTheWorld.Services.Photos;
using Microsoft.Extensions.Options;

namespace AroundTheWorld.Tests.Photos;

public class FileSystemPhotoStorageTests : IDisposable
{
    private readonly string root = Path.Combine(Path.GetTempPath(), $"atw-{Guid.NewGuid():N}");
    private readonly FileSystemPhotoStorage storage;

    public FileSystemPhotoStorageTests()
    {
        storage = new FileSystemPhotoStorage(
            Options.Create(new PhotoStorageOptions { LocalRootPath = root }),
            new PhotoKeyFactory());
    }

    [Fact]
    public async Task SaveAsync_then_OpenAsync_round_trips_the_bytes()
    {
        var key = await storage.SaveAsync(new MemoryStream("a drink"u8.ToArray()), "image/jpeg");

        await using var opened = await storage.OpenAsync(key);
        Assert.NotNull(opened);

        using var reader = new StreamReader(opened!, Encoding.UTF8);
        Assert.Equal("a drink", await reader.ReadToEndAsync());
    }

    [Fact]
    public async Task OpenAsync_returns_null_for_an_unknown_key()
    {
        Assert.Null(await storage.OpenAsync("nothing-here.jpg"));
    }

    [Theory]
    [InlineData("../appsettings.json")]
    [InlineData("../../secrets.json")]
    [InlineData("..\\..\\secrets.json")]
    [InlineData("sub/dir/file.jpg")]
    [InlineData("")]
    public async Task OpenAsync_refuses_a_key_that_tries_to_escape_the_store(string key)
    {
        // The key arrives straight off a URL, so traversal is an expected input.
        Assert.Null(await storage.OpenAsync(key));
    }

    [Fact]
    public void ResolveUrl_points_back_at_this_api()
    {
        Assert.Equal("/api/photos/abc.jpg", storage.ResolveUrl("abc.jpg"));
    }

    public void Dispose()
    {
        if (Directory.Exists(root))
        {
            Directory.Delete(root, recursive: true);
        }
    }
}
