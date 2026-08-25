using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AroundTheWorld.Abstractions.Enums;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Tests;

/// <summary>
/// GET /api/game against the real host. Also covers bootstrapping: a fresh
/// database must come up already playable, with a settings row and an open round.
/// </summary>
public class GameApiTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    [Fact]
    public async Task Get_game_returns_the_seeded_round_and_stop()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/game");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var state = await response.Content.ReadFromJsonAsync<GameStateResponse>(Json);
        Assert.NotNull(state);
        Assert.Equal("Round 1", state!.RoundName);
        Assert.Equal(1, state.CurrentStopNumber);
        Assert.True(state.RoundId > 0);
    }

    [Fact]
    public async Task Get_game_is_anonymous_so_the_join_screen_can_show_the_countdown()
    {
        using var factory = new GameApiFactory();
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/game");

        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("2026-08-28T15:59:59Z", GameMode.Practice)]
    [InlineData("2026-08-28T16:00:00Z", GameMode.Live)]
    [InlineData("2026-08-29T03:59:59Z", GameMode.Live)]
    [InlineData("2026-08-29T04:00:00Z", GameMode.Finished)]
    public async Task Get_game_reports_the_mode_for_the_current_instant(string instant, GameMode expected)
    {
        using var factory = new GameApiFactory(startAt: DateTimeOffset.Parse(instant).ToUniversalTime());
        var client = factory.CreateClient();

        var state = await client.GetFromJsonAsync<GameStateResponse>("/api/game", Json);

        Assert.Equal(expected, state!.Mode);
    }

    [Fact]
    public async Task Bootstrapping_creates_exactly_one_settings_row_and_one_open_round()
    {
        using var factory = new GameApiFactory();
        _ = factory.CreateClient();

        await factory.WithDbAsync(async db =>
        {
            Assert.Equal(1, await db.GameSettings.CountAsync());
            Assert.Equal(1, await db.Rounds.CountAsync(r => r.EndedAt == null));

            var settings = await db.GameSettings.SingleAsync();
            Assert.Equal("260802", settings.PartyCode);
            Assert.NotEqual(0, settings.ActiveRoundId);

            // The night of the pub crawl — 28 Aug 2026, 17:00 BST to 29 Aug, 05:00 BST.
            // Seeding happens exactly once on a fresh database, so a wrong value here
            // cannot be corrected by a redeploy, only from the admin page. Pinned as an
            // assertion rather than a doc comment because the date has already been
            // wrong once (it read 26 Aug).
            Assert.Equal(new DateTime(2026, 8, 28, 16, 0, 0, DateTimeKind.Utc), settings.GoLiveAt);
            Assert.Equal(new DateTime(2026, 8, 29, 4, 0, 0, DateTimeKind.Utc), settings.ReadOnlyAt);
        });
    }

    [Fact]
    public async Task Bootstrapping_is_idempotent_across_restarts()
    {
        using var factory = new GameApiFactory();
        _ = factory.CreateClient();

        // A second host over the same store stands in for a pod restart.
        await factory.WithDbAsync(async db =>
        {
            Assert.Equal(1, await db.GameSettings.CountAsync());
            Assert.Equal(1, await db.Rounds.CountAsync());
        });
    }
}
