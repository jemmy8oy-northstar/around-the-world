using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AroundTheWorld.Services.Configuration;
using AroundTheWorld.Tests.Auth;
using AroundTheWorld.Tests.Posts;
using Microsoft.Extensions.DependencyInjection;

namespace AroundTheWorld.Tests.Admin;

/// <summary>
/// The admin as a <em>user</em>: one named player gets the admin surface from the
/// phone they are already holding, rather than from a shared secret typed into a
/// hidden page.
/// </summary>
public class AdminUserTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private static async Task<(HttpClient Client, AuthSessionResponse Session)> JoinAsync(
        GameApiFactory factory,
        string username)
    {
        var client = factory.CreateClient();

        var session = await (await client.PostAsJsonAsync(
                "/api/auth/join", new { partyCode = "260802", username }))
            .Content.ReadFromJsonAsync<AuthSessionResponse>(Json);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", session!.AccessToken);

        return (client, session);
    }

    private static MultipartFormDataContent Drink(string caption = "lovely", string countryCode = "JP")
    {
        var photo = new ByteArrayContent([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3]);
        photo.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        return new MultipartFormDataContent
        {
            { photo, "photo", "drink.jpg" },
            { new StringContent(caption), "caption" },
            { new StringContent(countryCode), "countryCode" },
        };
    }

    // ---------------------------------------------------------------------
    // The claim actually survives the round trip
    // ---------------------------------------------------------------------

    /// <summary>
    /// The load-bearing test of this whole change. The admin marker is written by
    /// JwtSecurityTokenHandler and read back by the bearer handler, and both ends
    /// rewrite well-known claim types through mapping tables — so whether a claim
    /// arrives under the name it was written with is a question about two
    /// libraries, not about this code. Asserting it end-to-end is the only honest
    /// way to know; reasoning about the maps is not.
    /// </summary>
    [Fact]
    public async Task The_admin_s_own_token_opens_the_admin_routes_with_no_key()
    {
        using var factory = new GameApiFactory();
        var (james, _) = await JoinAsync(factory, "james");

        Assert.False(james.DefaultRequestHeaders.Contains("X-Admin-Key"));

        var response = await james.PostAsJsonAsync("/api/admin/stop/next", new { });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>
    /// The control for the test above: without it, a filter that simply let
    /// everyone through would pass just as happily.
    /// </summary>
    [Fact]
    public async Task An_ordinary_players_token_does_not_open_the_admin_routes()
    {
        using var factory = new GameApiFactory();
        var (dave, _) = await JoinAsync(factory, "Dave");

        var response = await dave.PostAsJsonAsync("/api/admin/stop/next", new { });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task The_admin_flag_still_holds_after_a_refresh()
    {
        using var factory = new GameApiFactory();
        var (_, session) = await JoinAsync(factory, "james");

        var refreshed = await (await factory.CreateClient().PostAsJsonAsync(
                "/api/auth/refresh", new { refreshToken = session.RefreshToken }))
            .Content.ReadFromJsonAsync<AuthSessionResponse>(Json);

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", refreshed!.AccessToken);

        // A refresh re-issues the access token, so a marker stamped only at join
        // would silently expire partway through the night.
        Assert.True(refreshed.IsAdmin);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/admin/stop/next", new { })).StatusCode);
    }

    // ---------------------------------------------------------------------
    // Who is the admin
    // ---------------------------------------------------------------------

    [Fact]
    public async Task Joining_as_the_admin_says_so_in_the_session()
    {
        using var factory = new GameApiFactory();
        var (_, session) = await JoinAsync(factory, "james");

        Assert.True(session.IsAdmin);
    }

    [Fact]
    public async Task Joining_as_anyone_else_does_not()
    {
        using var factory = new GameApiFactory();
        var (_, session) = await JoinAsync(factory, "Dave");

        Assert.False(session.IsAdmin);
    }

    [Theory]
    [InlineData("James")]
    [InlineData("JAMES")]
    [InlineData("  james  ")]
    public async Task The_admin_name_is_matched_the_same_way_the_game_stores_it(string typed)
    {
        using var factory = new GameApiFactory();
        var (_, session) = await JoinAsync(factory, typed);

        // Usernames are claimed trimmed and compared lower-cased, so the admin
        // check has to normalise identically or "James" would be a stranger.
        Assert.True(session.IsAdmin);
    }

    /// <summary>
    /// Fails closed. A blank configured name must make nobody the admin — the
    /// dangerous reading is that a blank matches a blank, or matches everyone.
    /// </summary>
    [Fact]
    public async Task A_blank_configured_admin_name_makes_nobody_the_admin()
    {
        using var factory = new GameApiFactory(
            services => services.Configure<AdminOptions>(options => options.Username = string.Empty));

        var (james, session) = await JoinAsync(factory, "james");

        Assert.False(session.IsAdmin);
        Assert.Equal(
            HttpStatusCode.Forbidden,
            (await james.PostAsJsonAsync("/api/admin/stop/next", new { })).StatusCode);
    }

    /// <summary>
    /// The shared key is kept deliberately as break-glass, so this proves the
    /// second door still opens after the first one was added.
    /// </summary>
    [Fact]
    public async Task The_shared_key_still_works_for_someone_who_never_joined()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", GameApiFactory.AdminKey);

        var response = await client.PostAsJsonAsync("/api/admin/stop/next", new { });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ---------------------------------------------------------------------
    // Moderating from the feed
    // ---------------------------------------------------------------------

    [Fact]
    public async Task The_admin_can_delete_someone_else_s_post_through_the_ordinary_route()
    {
        using var factory = new GameApiFactory();
        var (dave, _) = await JoinAsync(factory, "Dave");
        var (james, _) = await JoinAsync(factory, "james");

        var created = await (await dave.PostAsync("/api/posts", Drink()))
            .Content.ReadFromJsonAsync<PostResponse>(Json);

        var deleted = await james.DeleteAsync($"/api/posts/{created!.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Empty((await dave.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json))!);
    }

    /// <summary>
    /// The control that makes the test above mean something: widening the route
    /// for the admin must not widen it for everybody.
    /// </summary>
    [Fact]
    public async Task An_ordinary_player_still_cannot_delete_someone_else_s_post()
    {
        using var factory = new GameApiFactory();
        var (dave, _) = await JoinAsync(factory, "Dave");
        var (sam, _) = await JoinAsync(factory, "Sam");

        var created = await (await dave.PostAsync("/api/posts", Drink()))
            .Content.ReadFromJsonAsync<PostResponse>(Json);

        var response = await sam.DeleteAsync($"/api/posts/{created!.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task The_admin_sees_shadow_banned_posts_that_everyone_else_cannot()
    {
        using var factory = new GameApiFactory();
        var (dave, _) = await JoinAsync(factory, "Dave");
        var (sam, _) = await JoinAsync(factory, "Sam");
        var (james, _) = await JoinAsync(factory, "james");

        await dave.PostAsync("/api/posts", Drink("daves pint"));
        await james.PostAsJsonAsync("/api/admin/users/dave/ban", new { isShadowBanned = true });

        var samsFeed = await sam.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);
        var adminsFeed = await james.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);

        // A ban the admin can no longer see is a ban they can no longer lift.
        Assert.Empty(samsFeed!);
        Assert.Equal("daves pint", Assert.Single(adminsFeed!).Caption);
    }

    /// <summary>
    /// Guards the invariant DomainPost's own doc comment states: ban state "never
    /// reaches the wire model". Marking hidden posts in the admin UI is the exact
    /// pressure that would tempt someone to add the flag to <c>Post</c> — at which
    /// point a shadow-banned user could read their own ban out of their own feed
    /// and the feature would be silently pointless. Asserted against the raw JSON
    /// rather than a typed model, because a typed model only sees fields it knows.
    /// </summary>
    [Fact]
    public async Task The_post_wire_model_never_carries_ban_state()
    {
        using var factory = new GameApiFactory();
        var (dave, _) = await JoinAsync(factory, "Dave");
        var (james, _) = await JoinAsync(factory, "james");

        await dave.PostAsync("/api/posts", Drink("daves pint"));
        await james.PostAsJsonAsync("/api/admin/users/dave/ban", new { isShadowBanned = true });

        var davesFeed = await dave.GetStringAsync("/api/posts");
        var adminsFeed = await james.GetStringAsync("/api/posts");

        Assert.DoesNotContain("hadowban", davesFeed, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("hadowban", adminsFeed, StringComparison.OrdinalIgnoreCase);

        // Control: the feeds are not empty, so the assertions above are about
        // absent fields rather than absent posts.
        Assert.Contains("daves pint", davesFeed, StringComparison.Ordinal);
        Assert.Contains("daves pint", adminsFeed, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_banned_list_names_who_is_hidden()
    {
        using var factory = new GameApiFactory();
        var (dave, _) = await JoinAsync(factory, "Dave");
        await JoinAsync(factory, "Sam");
        var (james, _) = await JoinAsync(factory, "james");

        await dave.PostAsync("/api/posts", Drink());
        await james.PostAsJsonAsync("/api/admin/users/dave/ban", new { isShadowBanned = true });

        var banned = await james.GetFromJsonAsync<List<string>>("/api/admin/users/banned", Json);

        Assert.Equal("Dave", Assert.Single(banned!));
    }

    [Fact]
    public async Task Lifting_a_ban_takes_the_name_off_the_banned_list()
    {
        using var factory = new GameApiFactory();
        await JoinAsync(factory, "Dave");
        var (james, _) = await JoinAsync(factory, "james");

        await james.PostAsJsonAsync("/api/admin/users/dave/ban", new { isShadowBanned = true });
        await james.PostAsJsonAsync("/api/admin/users/dave/ban", new { isShadowBanned = false });

        Assert.Empty((await james.GetFromJsonAsync<List<string>>("/api/admin/users/banned", Json))!);
    }

    [Fact]
    public async Task The_banned_list_is_not_readable_by_an_ordinary_player()
    {
        using var factory = new GameApiFactory();
        var (dave, _) = await JoinAsync(factory, "Dave");

        var response = await dave.GetAsync("/api/admin/users/banned");

        // Otherwise the one place the ban is written down would be world-readable.
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
