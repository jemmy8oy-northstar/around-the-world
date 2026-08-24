namespace AroundTheWorld.Abstractions.Services;

/// <summary>
/// The current time, injected rather than read statically so the game-mode
/// state machine and the token-expiry logic can be tested at chosen instants.
/// </summary>
public interface IClock
{
    DateTime UtcNow { get; }
}
