using AroundTheWorld.Services.Admin;
using AroundTheWorld.Services.Configuration;
using Microsoft.Extensions.Options;

namespace AroundTheWorld.Tests.Admin;

/// <summary>
/// The single place that decides who the admin is. Unit-tested separately from
/// the routes because every other check in the system trusts this answer.
/// </summary>
public class AdminIdentityTests
{
    private static AdminIdentity For(string configured) =>
        new(Options.Create(new AdminOptions { Username = configured }));

    [Theory]
    [InlineData("james")]
    [InlineData("James")]
    [InlineData("JAMES")]
    [InlineData(" james ")]
    public void Matches_the_configured_name_however_it_is_typed(string typed) =>
        Assert.True(For("james").IsAdmin(typed));

    [Theory]
    [InlineData("jamie")]
    [InlineData("james2")]
    [InlineData("jame")]
    [InlineData("not-james")]
    public void Does_not_match_a_different_name(string typed) =>
        Assert.False(For("james").IsAdmin(typed));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void An_absent_name_is_never_the_admin(string? typed) =>
        Assert.False(For("james").IsAdmin(typed));

    /// <summary>
    /// The failure that would matter: a blank configuration must close the door,
    /// not open it to everyone — and in particular a blank must not match a blank.
    /// </summary>
    [Theory]
    [InlineData("james")]
    [InlineData("anyone")]
    [InlineData("")]
    [InlineData(null)]
    public void A_blank_configured_name_makes_nobody_the_admin(string? typed) =>
        Assert.False(For(string.Empty).IsAdmin(typed));

    [Fact]
    public void The_configured_name_is_normalised_too()
    {
        // Otherwise a stray capital or space in the deployment's config would
        // quietly leave the game with no admin at all.
        Assert.True(For("  James  ").IsAdmin("james"));
    }
}
