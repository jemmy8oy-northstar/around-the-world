using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AroundTheWorld.Tests.Auth;
using AroundTheWorld.Tests.Posts;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Tests;

/// <summary>
/// The birthday plug: tapping through to the YouTube channel is recorded against
/// the player, and every post they made — before or after — carries the badge.
/// </summary>
public class ChannelVisitTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private static async Task<HttpClient> JoinAsync(GameApiFactory factory, string username)
    {
        var client = factory.CreateClient();

        var session = await (await client.PostAsJsonAsync("/api/auth/join", new { username }))
            .Content.ReadFromJsonAsync<AuthSessionResponse>(Json);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", session!.AccessToken);

        return client;
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

    [Fact]
    public async Task Recording_a_visit_needs_a_token()
    {
        using var factory = new GameApiFactory();
        var anonymous = factory.CreateClient();

        var response = await anonymous.PostAsync("/api/me/channel-visit", null);

        // Otherwise the badge is worth nothing: anyone could hand it out.
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        // The status alone does NOT prove the route is authorised, and this was
        // measured rather than assumed: dropping RequireAuthorization() leaves
        // the whole suite green, because CurrentUser.IdFrom then throws its own
        // Unauthorized on the missing `sub` claim. Two guards, one observable
        // result. The challenge header is the part only the route-level one
        // emits, so asserting it is what actually pins the group's protection.
        Assert.Contains(
            response.Headers.WwwAuthenticate,
            header => header.Scheme == "Bearer");
    }

    [Fact]
    public async Task Recording_a_visit_marks_the_user()
    {
        using var factory = new GameApiFactory();
        var dave = await JoinAsync(factory, "Dave");

        var response = await dave.PostAsync("/api/me/channel-visit", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        await factory.WithDbAsync(async db =>
            Assert.NotNull((await db.Users.SingleAsync(u => u.Username == "Dave")).ChannelVisitedAt));
    }

    [Fact]
    public async Task Recording_a_visit_twice_keeps_the_first_timestamp()
    {
        using var factory = new GameApiFactory();
        var dave = await JoinAsync(factory, "Dave");

        await dave.PostAsync("/api/me/channel-visit", null);

        DateTime? first = null;
        await factory.WithDbAsync(async db =>
            first = (await db.Users.SingleAsync(u => u.Username == "Dave")).ChannelVisitedAt);

        factory.Clock.Advance(TimeSpan.FromHours(2));
        var second = await dave.PostAsync("/api/me/channel-visit", null);

        // Idempotent: a second tap is not new information, and must not read as
        // though it were.
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
        await factory.WithDbAsync(async db =>
            Assert.Equal(first, (await db.Users.SingleAsync(u => u.Username == "Dave")).ChannelVisitedAt));
    }

    [Fact]
    public async Task The_feed_flags_a_visitors_posts_including_ones_made_before_the_visit()
    {
        using var factory = new GameApiFactory();
        var dave = await JoinAsync(factory, "Dave");

        // Posted first, tapped through second — the badge is about the person,
        // not the post, so the earlier post must carry it too.
        await dave.PostAsync("/api/posts", Drink());
        await dave.PostAsync("/api/me/channel-visit", null);

        var feed = await dave.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);

        Assert.True(Assert.Single(feed!).AuthorVisitedChannel);
    }

    [Fact]
    public async Task The_feed_does_not_flag_someone_who_never_tapped()
    {
        using var factory = new GameApiFactory();
        var dave = await JoinAsync(factory, "Dave");

        await dave.PostAsync("/api/posts", Drink());

        var feed = await dave.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);

        Assert.False(Assert.Single(feed!).AuthorVisitedChannel);
    }

    [Fact]
    public async Task The_game_state_carries_the_channel_url_anonymously()
    {
        using var factory = new GameApiFactory();

        // Anonymous on purpose: the plug lives on the join screen, which nobody
        // has a token on yet.
        var state = await factory.CreateClient().GetFromJsonAsync<GameStateResponse>("/api/game", Json);

        Assert.Equal("https://www.youtube.com/@jemmy8oy", state!.YouTubeUrl);
    }

    [Fact]
    public async Task A_blank_channel_url_switches_the_plug_off()
    {
        using var factory = new GameApiFactory(configureConfiguration: settings =>
            settings["Game:YouTubeUrl"] = "");

        var state = await factory.CreateClient().GetFromJsonAsync<GameStateResponse>("/api/game", Json);

        // The kill switch. The app renders nothing when this is empty, so it has
        // to survive the round trip as empty rather than falling back to a default.
        Assert.Equal(string.Empty, state!.YouTubeUrl);
    }
}
