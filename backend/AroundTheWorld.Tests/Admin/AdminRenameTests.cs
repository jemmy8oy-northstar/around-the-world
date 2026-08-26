using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AroundTheWorld.Tests.Auth;
using AroundTheWorld.Tests.Posts;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Tests.Admin;

/// <summary>
/// Renaming a player in place. The distinction that matters throughout: a rename
/// is NOT a release-and-reclaim — they keep their session, their identity and
/// every post they have already made.
/// </summary>
public class AdminRenameTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private static HttpClient AdminClient(GameApiFactory factory)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Admin-Key", GameApiFactory.AdminKey);
        return client;
    }

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
    public async Task Renaming_needs_the_admin_key()
    {
        using var factory = new GameApiFactory();
        await JoinAsync(factory, "Dave");

        var response = await factory.CreateClient()
            .PostAsJsonAsync("/api/admin/users/dave/rename", new { newUsername = "Steve" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await factory.WithDbAsync(async db =>
            Assert.True(await db.Users.AnyAsync(u => u.Username == "Dave")));
    }

    [Fact]
    public async Task Renaming_changes_the_name_and_returns_what_was_stored()
    {
        using var factory = new GameApiFactory();
        await JoinAsync(factory, "Dave");

        var response = await AdminClient(factory)
            .PostAsJsonAsync("/api/admin/users/dave/rename", new { newUsername = "  Steve  " });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Trimmed on the way in, so the admin page must render what was saved
        // rather than what was typed.
        Assert.Equal("Steve", await response.Content.ReadFromJsonAsync<string>(Json));
    }

    [Fact]
    public async Task Renaming_keeps_their_session_and_re_attributes_their_posts()
    {
        using var factory = new GameApiFactory();
        var dave = await JoinAsync(factory, "Dave");
        await dave.PostAsync("/api/posts", Drink("Guinness"));

        await AdminClient(factory)
            .PostAsJsonAsync("/api/admin/users/dave/rename", new { newUsername = "Steve" });

        // The whole point of renaming rather than releasing: they never notice.
        var feed = await dave.GetFromJsonAsync<List<PostResponse>>("/api/posts", Json);

        var post = Assert.Single(feed!);
        Assert.Equal("Steve", post.Username);
        Assert.Equal("Guinness", post.Caption);
    }

    [Fact]
    public async Task Renaming_frees_the_old_name_for_someone_else()
    {
        using var factory = new GameApiFactory();
        await JoinAsync(factory, "Dave");

        await AdminClient(factory)
            .PostAsJsonAsync("/api/admin/users/dave/rename", new { newUsername = "Steve" });

        var response = await factory.CreateClient()
            .PostAsJsonAsync("/api/auth/join", new { username = "Dave" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Renaming_to_a_taken_name_conflicts()
    {
        using var factory = new GameApiFactory();
        await JoinAsync(factory, "Dave");
        await JoinAsync(factory, "Priya");

        var response = await AdminClient(factory)
            .PostAsJsonAsync("/api/admin/users/dave/rename", new { newUsername = "priya" });

        // Case-insensitive, or "priya" and "Priya" become two people with one name.
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Renaming_only_the_casing_is_allowed()
    {
        using var factory = new GameApiFactory();
        await JoinAsync(factory, "dave");

        var response = await AdminClient(factory)
            .PostAsJsonAsync("/api/admin/users/dave/rename", new { newUsername = "Dave" });

        // A real edit, and it must not collide with the user's own row on the
        // uniqueness check.
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await factory.WithDbAsync(async db =>
            Assert.Equal("Dave", (await db.Users.SingleAsync(u => u.UsernameNormalised == "dave")).Username));
    }

    [Theory]
    [InlineData("D")]
    [InlineData("")]
    [InlineData("this-name-is-far-too-long-to-fit-on-a-mobile-card")]
    [InlineData("drop$table")]
    public async Task Renaming_obeys_the_same_rules_as_claiming(string newUsername)
    {
        using var factory = new GameApiFactory();
        await JoinAsync(factory, "Dave");

        var response = await AdminClient(factory)
            .PostAsJsonAsync("/api/admin/users/dave/rename", new { newUsername });

        // A name reachable by rename that nobody could have claimed would be a
        // hole in both paths — which is why the rules live in one place.
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("james")]
    [InlineData("JAMES")]
    [InlineData("  james  ")]
    public async Task Renaming_someone_into_the_hosts_name_is_refused(string newUsername)
    {
        using var factory = new GameApiFactory();
        await JoinAsync(factory, "Dave");

        var response = await AdminClient(factory)
            .PostAsJsonAsync("/api/admin/users/dave/rename", new { newUsername });

        // Admin is granted by USERNAME, so this would hand Dave the admin panel
        // at his next token refresh — silently, up to twelve hours later. The
        // host claims that name at the join screen with the host code, nowhere else.
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await factory.WithDbAsync(async db =>
            Assert.True(await db.Users.AnyAsync(u => u.Username == "Dave")));
    }

    [Fact]
    public async Task The_host_can_still_be_renamed_out_of_his_own_name()
    {
        using var factory = new GameApiFactory();
        await factory.CreateClient()
            .PostAsJsonAsync("/api/auth/join", new { partyCode = "260802", username = "james" });

        var response = await AdminClient(factory)
            .PostAsJsonAsync("/api/admin/users/james/rename", new { newUsername = "Jimmy" });

        // The guard is about handing admin OUT, not about freezing the host's row.
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Renaming_someone_who_is_not_here_is_a_404()
    {
        using var factory = new GameApiFactory();

        var response = await AdminClient(factory)
            .PostAsJsonAsync("/api/admin/users/nobody/rename", new { newUsername = "Steve" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
