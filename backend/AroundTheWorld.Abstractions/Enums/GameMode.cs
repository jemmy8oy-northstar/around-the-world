namespace AroundTheWorld.Abstractions.Enums;

/// <summary>
/// Which phase of the night the game is in. Derived from the clock on every
/// request rather than stored — see docs/spec.md §3.
/// </summary>
public enum GameMode
{
    /// <summary>Before go-live. Fully usable, but obviously not the real event.</summary>
    Practice = 0,

    /// <summary>The real thing.</summary>
    Live = 1,

    /// <summary>After the cutover. Read-only keepsake — no more posting.</summary>
    Finished = 2,
}
