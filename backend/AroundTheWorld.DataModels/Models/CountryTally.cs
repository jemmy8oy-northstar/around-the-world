using AroundTheWorld.Abstractions.DataModels;

namespace AroundTheWorld.DataModels.Models;

public class CountryTally : ICountryTally
{
    public required string CountryCode { get; set; }

    public int PostCount { get; set; }
}
