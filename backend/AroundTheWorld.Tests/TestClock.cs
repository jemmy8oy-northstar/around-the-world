using AroundTheWorld.Abstractions.Services;

namespace AroundTheWorld.Tests;

/// <summary>A clock the test drives, so cutover behaviour is checked at exact instants.</summary>
public sealed class TestClock : IClock
{
    /// <summary>Defaults to a moment inside the live window of the seeded game.</summary>
    public DateTime UtcNow { get; set; } = new(2026, 8, 26, 20, 0, 0, DateTimeKind.Utc);
}
