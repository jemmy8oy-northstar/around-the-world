namespace AroundTheWorld.Tests.Posts;

public sealed class PostResponse
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string Username { get; set; } = string.Empty;

    public string PhotoUrl { get; set; } = string.Empty;

    public string Caption { get; set; } = string.Empty;

    public string CountryCode { get; set; } = string.Empty;

    public int StopNumber { get; set; }

    public DateTime CreatedAt { get; set; }
}
