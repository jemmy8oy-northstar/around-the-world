namespace AroundTheWorld.Abstractions.Services;

/// <summary>
/// Creates the singleton settings row and the first round on a fresh database,
/// so the app is playable immediately after a migration with no manual seeding.
/// </summary>
public interface IGameBootstrapper
{
    Task EnsureInitialisedAsync(CancellationToken cancellationToken = default);
}
