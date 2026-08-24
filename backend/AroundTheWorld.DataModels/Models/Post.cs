using AroundTheWorld.Abstractions.DataModels;

namespace AroundTheWorld.DataModels.Models;

public class Post : IPost
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public required string Username { get; set; }

    public required string PhotoUrl { get; set; }

    public required string Caption { get; set; }

    public required string CountryCode { get; set; }

    public int StopNumber { get; set; }

    public DateTime CreatedAt { get; set; }
}
