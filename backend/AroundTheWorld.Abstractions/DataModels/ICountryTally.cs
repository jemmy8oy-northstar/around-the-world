namespace AroundTheWorld.Abstractions.DataModels;

/// <summary>How many drinks came from one country. Powers the map badges and the leaderboard.</summary>
public interface ICountryTally
{
    string CountryCode { get; set; }

    int PostCount { get; set; }
}
