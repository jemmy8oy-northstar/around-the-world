namespace AroundTheWorld.Abstractions.Services.Countries;

public interface ICountryCatalogue
{
    /// <summary>True when the code is a real ISO 3166-1 alpha-2 country code.</summary>
    bool IsKnown(string? countryCode);

    /// <summary>
    /// Normalises a submitted code to its canonical upper-case form, throwing when
    /// it is not a country we recognise.
    /// </summary>
    string Normalise(string? countryCode);
}
