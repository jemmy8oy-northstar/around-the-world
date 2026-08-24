namespace AroundTheWorld.Abstractions.Services.Admin;

public interface IGameSettingsService
{
    /// <summary>Moves the two cutover instants that drive the game-mode state machine.</summary>
    Task UpdateCutoversAsync(
        DateTime goLiveAt,
        DateTime readOnlyAt,
        CancellationToken cancellationToken = default);
}
