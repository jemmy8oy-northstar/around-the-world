using AroundTheWorld.Services.Photos;

namespace AroundTheWorld.Tests.Photos;

public class PhotoKeyFactoryTests
{
    private readonly PhotoKeyFactory factory = new();

    [Theory]
    [InlineData("image/jpeg", ".jpg")]
    [InlineData("image/png", ".png")]
    [InlineData("image/webp", ".webp")]
    [InlineData("image/heic", ".heic")]
    [InlineData("image/jpeg; charset=binary", ".jpg")]
    [InlineData("something/unknown", ".jpg")]
    public void Create_uses_the_extension_for_the_media_type(string contentType, string expectedExtension)
    {
        Assert.EndsWith(expectedExtension, factory.Create(contentType));
    }

    [Fact]
    public void Create_returns_a_distinct_key_each_time()
    {
        var keys = Enumerable.Range(0, 200).Select(_ => factory.Create("image/jpeg")).ToHashSet();

        Assert.Equal(200, keys.Count);
    }

    [Fact]
    public void Create_leaks_nothing_about_the_poster()
    {
        // The key ends up in a public URL. It must not be guessable or enumerable,
        // and must not carry a username, round or timestamp.
        var key = factory.Create("image/jpeg");

        Assert.Matches("^[0-9a-f]{32}\\.jpg$", key);
    }
}
