namespace AroundTheWorld.Tests.Posts;

public sealed class CountryTallyResponse
{
    public string CountryCode { get; set; } = string.Empty;

    public int PostCount { get; set; }
}
