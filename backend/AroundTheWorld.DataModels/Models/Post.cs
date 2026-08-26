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

    /// <summary>
    /// The author tapped through to the YouTube channel. It is a *click*, which
    /// is the only thing a website can observe — YouTube tells us nothing about
    /// whether they went on to subscribe. The badge in the feed is a thank-you
    /// for looking, and this name keeps the data honest about what it holds.
    /// </summary>
    public bool AuthorVisitedChannel { get; set; }

    public DateTime CreatedAt { get; set; }
}
