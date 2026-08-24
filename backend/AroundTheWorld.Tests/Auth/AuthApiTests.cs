using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Tests.Auth;

/// <summary>
/// The join and refresh journeys through the real host — routing, model binding,
/// the exception handler's ProblemDetails mapping, and the database effects.
/// </summary>
public class AuthApiTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private static object Join(string code = "260802", string username = "Dave") =>
        new { partyCode = code, username };

    [Fact]
    public async Task Join_with_the_right_code_returns_a_token_pair()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/join", Join());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var session = await response.Content.ReadFromJsonAsync<AuthSessionResponse>(Json);
        Assert.False(string.IsNullOrWhiteSpace(session!.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(session.RefreshToken));
        Assert.Equal("Dave", session.Username);
        Assert.NotEqual(Guid.Empty, session.UserId);
    }

    [Fact]
    public async Task Join_with_the_wrong_code_is_rejected_and_creates_no_user()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/join", Join(code: "000000"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        // A stranger must not be able to squat names without getting in.
        await factory.WithDbAsync(async db => Assert.Equal(0, await db.Users.CountAsync()));
    }

    [Theory]
    [InlineData(" 260802 ")]
    [InlineData("260802")]
    public async Task Join_tolerates_whitespace_around_the_code(string code)
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/join", Join(code: code));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Join_with_a_taken_name_conflicts()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        await client.PostAsJsonAsync("/api/auth/join", Join(username: "Dave"));
        var second = await client.PostAsJsonAsync("/api/auth/join", Join(username: "dave"));

        // Case-insensitive: "dave" must not be able to impersonate "Dave".
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Theory]
    [InlineData("D")]
    [InlineData("")]
    [InlineData("this-name-is-far-too-long-to-fit-on-a-mobile-card")]
    [InlineData("drop$table")]
    public async Task Join_rejects_a_malformed_name(string username)
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/join", Join(username: username));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_returns_a_new_pair()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        var joined = await (await client.PostAsJsonAsync("/api/auth/join", Join()))
            .Content.ReadFromJsonAsync<AuthSessionResponse>(Json);

        var response = await client.PostAsJsonAsync(
            "/api/auth/refresh", new { refreshToken = joined!.RefreshToken });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var refreshed = await response.Content.ReadFromJsonAsync<AuthSessionResponse>(Json);
        Assert.NotEqual(joined.RefreshToken, refreshed!.RefreshToken);
        Assert.Equal(joined.UserId, refreshed.UserId);
    }

    [Fact]
    public async Task Refresh_tokens_are_single_use()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        var joined = await (await client.PostAsJsonAsync("/api/auth/join", Join()))
            .Content.ReadFromJsonAsync<AuthSessionResponse>(Json);

        await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = joined!.RefreshToken });
        var replay = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = joined.RefreshToken });

        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
    }

    [Fact]
    public async Task Refresh_with_an_unknown_token_is_rejected()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = "not-a-token" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_after_the_session_expires_is_rejected()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        var joined = await (await client.PostAsJsonAsync("/api/auth/join", Join()))
            .Content.ReadFromJsonAsync<AuthSessionResponse>(Json);

        factory.Clock.UtcNow = factory.Clock.UtcNow.AddDays(91);

        var response = await client.PostAsJsonAsync(
            "/api/auth/refresh", new { refreshToken = joined!.RefreshToken });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task The_refresh_token_is_never_stored_in_plaintext()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        var joined = await (await client.PostAsJsonAsync("/api/auth/join", Join()))
            .Content.ReadFromJsonAsync<AuthSessionResponse>(Json);

        await factory.WithDbAsync(async db =>
        {
            var stored = await db.Sessions.Select(s => s.RefreshTokenHash).ToListAsync();
            Assert.NotEmpty(stored);
            Assert.DoesNotContain(joined!.RefreshToken, stored);
        });
    }
}
