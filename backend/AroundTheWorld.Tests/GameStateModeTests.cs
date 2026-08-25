using AroundTheWorld.Abstractions.Enums;
using AroundTheWorld.DomainModels.Models;

namespace AroundTheWorld.Tests;

/// <summary>
/// The game-mode state machine (docs/spec.md §3). Both cutovers are
/// inclusive-from, so the boundary instants themselves belong to the later mode.
/// </summary>
public class GameStateModeTests
{
    private static readonly DateTime GoLive = new(2026, 8, 26, 16, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime ReadOnly = new(2026, 8, 27, 4, 0, 0, DateTimeKind.Utc);

    private static DomainGameState State() => new()
    {
        RoundName = "Round 1",
        RoundId = 1,
        CurrentStopNumber = 1,
        GoLiveAt = GoLive,
        ReadOnlyAt = ReadOnly,
    };

    [Fact]
    public void ResolveMode_BeforeGoLive_IsPractice()
    {
        Assert.Equal(GameMode.Practice, State().ResolveMode(GoLive.AddSeconds(-1)));
    }

    [Fact]
    public void ResolveMode_AtGoLiveInstant_IsLive()
    {
        Assert.Equal(GameMode.Live, State().ResolveMode(GoLive));
    }

    [Fact]
    public void ResolveMode_BetweenCutovers_IsLive()
    {
        Assert.Equal(GameMode.Live, State().ResolveMode(GoLive.AddHours(6)));
    }

    [Fact]
    public void ResolveMode_AtReadOnlyInstant_IsFinished()
    {
        Assert.Equal(GameMode.Finished, State().ResolveMode(ReadOnly));
    }

    [Fact]
    public void ResolveMode_AfterReadOnly_IsFinished()
    {
        Assert.Equal(GameMode.Finished, State().ResolveMode(ReadOnly.AddDays(365)));
    }

    [Theory]
    [InlineData(-1, true)]   // practice — deliberately postable, the build week needs it
    [InlineData(0, true)]    // the moment it goes live
    [InlineData(3600, true)] // mid-crawl
    public void AllowsPosting_BeforeReadOnly_IsTrue(int secondsFromGoLive, bool expected)
    {
        Assert.Equal(expected, State().AllowsPosting(GoLive.AddSeconds(secondsFromGoLive)));
    }

    [Fact]
    public void AllowsPosting_OnceFinished_IsFalse()
    {
        Assert.False(State().AllowsPosting(ReadOnly));
    }

    [Fact]
    public void ResolveMode_WhenGoLiveIsAfterReadOnly_PrefersFinished()
    {
        // A misconfigured pair should fail closed rather than reopen a finished game.
        var state = State();
        state.GoLiveAt = ReadOnly.AddHours(1);

        Assert.Equal(GameMode.Finished, state.ResolveMode(ReadOnly.AddMinutes(30)));
    }
}
