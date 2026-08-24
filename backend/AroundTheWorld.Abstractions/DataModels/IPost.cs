namespace AroundTheWorld.Abstractions.DataModels;

public interface IPost
{
    Guid Id { get; set; }

    Guid UserId { get; set; }

    string Username { get; set; }

    /// <summary>Resolved by the storage layer — may point at a bucket or back at this API.</summary>
    string PhotoUrl { get; set; }

    string Caption { get; set; }

    /// <summary>ISO 3166-1 alpha-2. Where the drink is from, not where the drinker is.</summary>
    string CountryCode { get; set; }

    int StopNumber { get; set; }

    DateTime CreatedAt { get; set; }
}
