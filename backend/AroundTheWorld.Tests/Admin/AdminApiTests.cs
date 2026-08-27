using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AroundTheWorld.Tests.Auth;
using AroundTheWorld.Tests.Posts;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Tests.Admin;

/// <summary>
/// The admin surface and the behaviours it drives — shadow banning, the pub stop,
/// the round reset, and releasing a claimed name.
/// </summary>
public class AdminApiTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        // The API sends enum names, not ordinals — see ConfigureHttpJsonOptions.
        Converters = { new JsonStringEnumConverter() },
    };

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

    private static HttpClient AdminClient(GameApiFactory factory, string? key = null)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", key ?? GameApiFactory.AdminKey);
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
    public async Task Admin_routes_reject_a_missing_key()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/admin/stop/next", new { });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Admin_routes_reject_a_wrong_key()
    {
        using var factory = new GameApiFactory();
        var client = AdminClient(factory, "not-the-key");

        var response = await client.PostAsJsonAsync("/api/admin/stop/next", new { });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Advancing_the_stop_increments_it()
    {
        using var factory = new GameApiFactory();
        var admin = AdminClient(factory);

        var first = await (await admin.PostAsJsonAsync("/api/admin/stop/next", new { }))
            .Content.ReadFromJsonAsync<int>(Json);

        // Past the cooldown, so this asserts the ordinary case rather than the
        // guard. The two used to run back to back; that they no longer can is
        // the change.
        factory.Clock.Advance(TimeSpan.FromMinutes(6));

        var second = await (await admin.PostAsJsonAsync("/api/admin/stop/next", new { }))
            .Content.ReadFromJsonAsync<int>(Json);

        Assert.Equal(2, first);
        Assert.Equal(3, second);
    }

    [Fact]
    public async Task A_second_advance_inside_five_minutes_is_refused()
    {
        using var factory = new GameApiFactory();
        var admin = AdminClient(factory);

        await admin.PostAsJsonAsync("/api/admin/stop/next", new { });
        factory.Clock.Advance(TimeSpan.FromMinutes(2));

        var response = await admin.PostAsJsonAsync("/api/admin/stop/next", new { });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        // The refusal has to say which tap it is talking about and offer the way
        // through, because it is read once, on a phone, in a pub.
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(Json);
        Assert.Contains("stop 2", problem!.Detail);
        Assert.Contains("2 minutes ago", problem.Detail);
        Assert.Contains("stop 3 anyway?", problem.Detail);

        // And it did not half-happen: the refused call left the stop alone.
        await factory.WithDbAsync(async db =>
            Assert.Equal(2, (await db.Rounds.SingleAsync(r => r.EndedAt == null)).CurrentStopNumber));
    }

    [Fact]
    public async Task A_refused_advance_goes_through_when_forced()
    {
        using var factory = new GameApiFactory();
        var admin = AdminClient(factory);

        await admin.PostAsJsonAsync("/api/admin/stop/next", new { });
        factory.Clock.Advance(TimeSpan.FromSeconds(30));

        Assert.Equal(
            HttpStatusCode.Conflict,
            (await admin.PostAsJsonAsync("/api/admin/stop/next", new { })).StatusCode);

        // Same instant, same round — only the admin's confirmation differs. The
        // guard must never be able to strand him at the wrong stop, because
        // there is no way back short of restarting the whole round.
        var forced = await admin.PostAsJsonAsync("/api/admin/stop/next", new { force = true });

        Assert.Equal(HttpStatusCode.OK, forced.StatusCode);
        Assert.Equal(3, await forced.Content.ReadFromJsonAsync<int>(Json));
    }

    [Fact]
    public async Task The_first_advance_of_a_round_is_never_questioned()
    {
        using var factory = new GameApiFactory();
        var admin = AdminClient(factory);

        // A fresh round has no previous advance to have mis-tapped against. If
        // the cooldown keyed off StartedAt instead, this would be refused —
        // locking the night out of its own first pub for five minutes.
        var response = await admin.PostAsJsonAsync("/api/admin/stop/next", new { });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, await response.Content.ReadFromJsonAsync<int>(Json));
    }

    [Fact]
    public async Task Starting_a_new_round_clears_the_cooldown()
    {
        using var factory = new GameApiFactory();
        var admin = AdminClient(factory);

        await admin.PostAsJsonAsync("/api/admin/stop/next", new { });
        factory.Clock.Advance(TimeSpan.FromSeconds(10));

        await admin.PostAsJsonAsync("/api/admin/round", new { });

        // The new round is a new night. Carrying the old round's timestamp over
        // would refuse its very first advance for no reason anyone could see.
        var response = await admin.PostAsJsonAsync("/api/admin/stop/next", new { });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, await response.Content.ReadFromJsonAsync<int>(Json));
    }

    [Fact]
    public async Task A_shadow_banned_user_still_sees_their_own_posts()
    {
        using var factory = new GameApiFactory();
        var dave = await JoinAsync(factory, "Dave");
        var admin = AdminClient(factory);

        await dave.PostAsync("/api/posts", Drink("daves pint"));
        await admin.PostAsJsonAsync("/api/admin/users/dave/ban", new { isShadowBanned = true });

        var feed = await dave.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);

        // The whole point of a shadow ban: from their side, nothing happened.
        Assert.Equal("daves pint", Assert.Single(feed!).Caption);
    }

    [Fact]
    public async Task A_shadow_banned_users_posts_are_hidden_from_everyone_else()
    {
        using var factory = new GameApiFactory();
        var dave = await JoinAsync(factory, "Dave");
        var sam = await JoinAsync(factory, "Sam");
        var admin = AdminClient(factory);

        await dave.PostAsync("/api/posts", Drink("daves pint"));
        await sam.PostAsync("/api/posts", Drink("sams pint"));
        await admin.PostAsJsonAsync("/api/admin/users/dave/ban", new { isShadowBanned = true });

        var feed = await sam.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);

        Assert.Equal("sams pint", Assert.Single(feed!).Caption);
    }

    [Fact]
    public async Task A_shadow_banned_users_drinks_do_not_swell_the_country_tally()
    {
        using var factory = new GameApiFactory();
        var dave = await JoinAsync(factory, "Dave");
        var sam = await JoinAsync(factory, "Sam");
        var admin = AdminClient(factory);

        await dave.PostAsync("/api/posts", Drink("a", "JP"));
        await dave.PostAsync("/api/posts", Drink("b", "JP"));
        await sam.PostAsync("/api/posts", Drink("c", "JP"));
        await admin.PostAsJsonAsync("/api/admin/users/dave/ban", new { isShadowBanned = true });

        var samsTally = await sam.GetFromJsonAsync<List<CountryTallyResponse>>("/api/countries", Json);
        var davesTally = await dave.GetFromJsonAsync<List<CountryTallyResponse>>("/api/countries", Json);

        // Otherwise the map badge would give the ban away.
        Assert.Equal(1, Assert.Single(samsTally!).PostCount);
        Assert.Equal(3, Assert.Single(davesTally!).PostCount);
    }

    [Fact]
    public async Task Unbanning_puts_the_posts_back()
    {
        using var factory = new GameApiFactory();
        var dave = await JoinAsync(factory, "Dave");
        var sam = await JoinAsync(factory, "Sam");
        var admin = AdminClient(factory);

        await dave.PostAsync("/api/posts", Drink("daves pint"));
        await admin.PostAsJsonAsync("/api/admin/users/dave/ban", new { isShadowBanned = true });
        await admin.PostAsJsonAsync("/api/admin/users/dave/ban", new { isShadowBanned = false });

        var feed = await sam.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);

        Assert.Single(feed!);
    }

    [Fact]
    public async Task Starting_a_new_round_clears_the_feed_without_deleting_anything()
    {
        using var factory = new GameApiFactory();
        var dave = await JoinAsync(factory, "Dave");
        var admin = AdminClient(factory);

        await dave.PostAsync("/api/posts", Drink("from the old round"));
        await admin.PostAsJsonAsync("/api/admin/round", new { });

        var feed = await dave.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);
        Assert.Empty(feed!);

        await factory.WithDbAsync(async db =>
        {
            // The reset is an archive, not a truncate — the night stays browsable.
            Assert.Equal(1, await db.Posts.CountAsync());
            Assert.False(await db.Posts.AnyAsync(p => p.IsDeleted));

            // Exactly one round open at any moment.
            Assert.Equal(2, await db.Rounds.CountAsync());
            Assert.Equal(1, await db.Rounds.CountAsync(r => r.EndedAt == null));
        });
    }

    [Fact]
    public async Task Starting_a_new_round_resets_the_pub_stop()
    {
        using var factory = new GameApiFactory();
        var admin = AdminClient(factory);

        await admin.PostAsJsonAsync("/api/admin/stop/next", new { });
        await admin.PostAsJsonAsync("/api/admin/round", new { });

        var state = await factory.CreateClient().GetFromJsonAsync<GameStateResponse>("/api/game", Json);

        Assert.Equal(1, state!.CurrentStopNumber);
    }

    [Fact]
    public async Task Cutovers_can_be_moved()
    {
        using var factory = new GameApiFactory();
        var admin = AdminClient(factory);

        var response = await admin.PutAsJsonAsync("/api/admin/settings", new
        {
            goLiveAt = "2026-09-01T17:00:00Z",
            readOnlyAt = "2026-09-02T05:00:00Z",
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var state = await factory.CreateClient().GetFromJsonAsync<GameStateResponse>("/api/game", Json);
        Assert.Equal(new DateTime(2026, 9, 1, 17, 0, 0), state!.GoLiveAt);
    }

    [Fact]
    public async Task Cutovers_in_the_wrong_order_are_refused()
    {
        using var factory = new GameApiFactory();
        var admin = AdminClient(factory);

        var response = await admin.PutAsJsonAsync("/api/admin/settings", new
        {
            goLiveAt = "2026-09-02T17:00:00Z",
            readOnlyAt = "2026-09-01T05:00:00Z",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Releasing_a_username_lets_it_be_claimed_again()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();
        var admin = AdminClient(factory);

        await client.PostAsJsonAsync("/api/auth/join", new { partyCode = "260802", username = "Dave" });

        var blocked = await client.PostAsJsonAsync(
            "/api/auth/join", new { partyCode = "260802", username = "Dave" });
        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);

        await admin.PostAsJsonAsync("/api/admin/users/dave/release", new { });

        // The fix for a dead phone.
        var reclaimed = await client.PostAsJsonAsync(
            "/api/auth/join", new { partyCode = "260802", username = "Dave" });
        Assert.Equal(HttpStatusCode.OK, reclaimed.StatusCode);
    }

    [Fact]
    public async Task Releasing_a_username_keeps_their_existing_posts_in_the_feed()
    {
        using var factory = new GameApiFactory();
        var dave = await JoinAsync(factory, "Dave");
        var sam = await JoinAsync(factory, "Sam");
        var admin = AdminClient(factory);

        await dave.PostAsync("/api/posts", Drink("daves pint"));
        await admin.PostAsJsonAsync("/api/admin/users/dave/release", new { });

        var feed = await sam.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);

        // Releasing a name must not blank the feed of everything they posted.
        Assert.Equal("daves pint", Assert.Single(feed!).Caption);
    }

    [Fact]
    public async Task Releasing_a_username_revokes_the_old_devices_session()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();
        var admin = AdminClient(factory);

        var session = await (await client.PostAsJsonAsync(
                "/api/auth/join", new { partyCode = "260802", username = "Dave" }))
            .Content.ReadFromJsonAsync<AuthSessionResponse>(Json);

        await admin.PostAsJsonAsync("/api/admin/users/dave/release", new { });

        var refresh = await client.PostAsJsonAsync(
            "/api/auth/refresh", new { refreshToken = session!.RefreshToken });

        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
    }

    [Fact]
    public async Task Admin_can_delete_anyone_s_post()
    {
        using var factory = new GameApiFactory();
        var dave = await JoinAsync(factory, "Dave");
        var admin = AdminClient(factory);

        var created = await (await dave.PostAsync("/api/posts", Drink()))
            .Content.ReadFromJsonAsync<PostResponse>(Json);

        var deleted = await admin.DeleteAsync($"/api/admin/posts/{created!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        var feed = await dave.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);
        Assert.Empty(feed!);
    }

    [Fact]
    public async Task Banning_someone_who_does_not_exist_is_a_not_found()
    {
        using var factory = new GameApiFactory();
        var admin = AdminClient(factory);

        var response = await admin.PostAsJsonAsync(
            "/api/admin/users/nobody/ban", new { isShadowBanned = true });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
