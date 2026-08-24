using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using AroundTheWorld.Tests.Auth;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Tests.Posts;

/// <summary>
/// The post → feed → aggregation path through the real host, including the
/// shadow-ban visibility rules and the read-only cutover.
/// </summary>
public class PostApiTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static async Task<HttpClient> JoinAsync(GameApiFactory factory, string username)
    {
        var client = factory.CreateClient();

        var session = await (await client.PostAsJsonAsync(
                "/api/auth/join", new { partyCode = "260802", username }))
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
    public async Task Posting_a_drink_puts_it_in_the_feed()
    {
        using var factory = new GameApiFactory();
        var client = await JoinAsync(factory, "Dave");

        var created = await client.PostAsync("/api/posts", Drink("first pint", "IE"));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var feed = await client.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);

        var post = Assert.Single(feed!);
        Assert.Equal("first pint", post.Caption);
        Assert.Equal("IE", post.CountryCode);
        Assert.Equal("Dave", post.Username);
        Assert.False(string.IsNullOrWhiteSpace(post.PhotoUrl));
    }

    [Fact]
    public async Task Posting_requires_a_token()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        var response = await client.PostAsync("/api/posts", Drink());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Posting_stamps_the_current_pub_stop()
    {
        using var factory = new GameApiFactory();
        var client = await JoinAsync(factory, "Dave");
        var admin = AdminClient(factory);

        await client.PostAsync("/api/posts", Drink("stop one"));
        await admin.PostAsJsonAsync("/api/admin/stop/next", new { });
        await client.PostAsync("/api/posts", Drink("stop two"));

        var feed = await client.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);

        // Stamped at creation, so advancing the stop must not retroactively move
        // the earlier drink.
        Assert.NotNull(feed);
        Assert.Equal(2, feed!.Single(p => p.Caption == "stop two").StopNumber);
        Assert.Equal(1, feed.Single(p => p.Caption == "stop one").StopNumber);
    }

    [Fact]
    public async Task Posting_is_refused_once_the_game_is_finished()
    {
        using var factory = new GameApiFactory();
        var client = await JoinAsync(factory, "Dave");

        factory.Clock.SetUtcNow(new DateTimeOffset(2026, 8, 27, 5, 0, 0, TimeSpan.Zero));

        var response = await client.PostAsync("/api/posts", Drink());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Posting_rejects_an_unknown_country()
    {
        using var factory = new GameApiFactory();
        var client = await JoinAsync(factory, "Dave");

        var response = await client.PostAsync("/api/posts", Drink(countryCode: "ZZ"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task The_feed_can_be_filtered_to_one_country()
    {
        using var factory = new GameApiFactory();
        var client = await JoinAsync(factory, "Dave");

        await client.PostAsync("/api/posts", Drink("sake", "JP"));
        await client.PostAsync("/api/posts", Drink("guinness", "IE"));

        var japanese = await client.GetFromJsonAsync<List<PostResponse>>("/api/posts?country=jp", Json);

        Assert.Equal("sake", Assert.Single(japanese!).Caption);
    }

    [Fact]
    public async Task The_country_tally_counts_drinks_per_country_highest_first()
    {
        using var factory = new GameApiFactory();
        var client = await JoinAsync(factory, "Dave");

        await client.PostAsync("/api/posts", Drink("a", "JP"));
        await client.PostAsync("/api/posts", Drink("b", "JP"));
        await client.PostAsync("/api/posts", Drink("c", "IE"));

        var tally = await client.GetFromJsonAsync<List<CountryTallyResponse>>("/api/countries", Json);

        Assert.Equal("JP", tally![0].CountryCode);
        Assert.Equal(2, tally[0].PostCount);
        Assert.Equal("IE", tally[1].CountryCode);
        Assert.Equal(1, tally[1].PostCount);
    }

    [Fact]
    public async Task Deleting_your_own_post_removes_it_from_the_feed_but_keeps_the_row()
    {
        using var factory = new GameApiFactory();
        var client = await JoinAsync(factory, "Dave");

        var created = await (await client.PostAsync("/api/posts", Drink()))
            .Content.ReadFromJsonAsync<PostResponse>(Json);

        var deleted = await client.DeleteAsync($"/api/posts/{created!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        var feed = await client.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);
        Assert.Empty(feed!);

        // Soft delete only — nothing is ever removed from the database.
        await factory.WithDbAsync(async db =>
            Assert.True(await db.Posts.AnyAsync(p => p.Id == created.Id && p.IsDeleted)));
    }

    [Fact]
    public async Task You_cannot_delete_someone_elses_post()
    {
        using var factory = new GameApiFactory();
        var dave = await JoinAsync(factory, "Dave");
        var sam = await JoinAsync(factory, "Sam");

        var created = await (await dave.PostAsync("/api/posts", Drink()))
            .Content.ReadFromJsonAsync<PostResponse>(Json);

        var response = await sam.DeleteAsync($"/api/posts/{created!.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Deleting_twice_is_a_no_op_rather_than_an_error()
    {
        using var factory = new GameApiFactory();
        var client = await JoinAsync(factory, "Dave");

        var created = await (await client.PostAsync("/api/posts", Drink()))
            .Content.ReadFromJsonAsync<PostResponse>(Json);

        await client.DeleteAsync($"/api/posts/{created!.Id}");
        var second = await client.DeleteAsync($"/api/posts/{created.Id}");

        // A double-tap on a flaky pub connection must not show an error.
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
    }

    private static HttpClient AdminClient(GameApiFactory factory)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", GameApiFactory.AdminKey);
        return client;
    }
}
