using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Services.Countries;

namespace AroundTheWorld.Tests.Posts;

public class CountryCatalogueTests
{
    private readonly CountryCatalogue catalogue = new();

    [Theory]
    [InlineData("GB")]
    [InlineData("gb")]
    [InlineData(" JP ")]
    [InlineData("IE")]
    public void IsKnown_accepts_a_real_code_in_any_casing(string code)
    {
        Assert.True(catalogue.IsKnown(code));
    }

    [Theory]
    [InlineData("XX")]
    [InlineData("GBR")]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("1")]
    public void IsKnown_rejects_anything_that_is_not_a_country(string? code)
    {
        Assert.False(catalogue.IsKnown(code));
    }

    [Fact]
    public void Normalise_upper_cases_and_trims()
    {
        Assert.Equal("JP", catalogue.Normalise(" jp "));
    }

    [Fact]
    public void Normalise_rejects_an_unknown_code()
    {
        Assert.Throws<ValidationException>(() => catalogue.Normalise("ZZ"));
    }
}
