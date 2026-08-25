namespace AroundTheWorld.Abstractions.Services;

public interface IActiveRoundReader
{
    /// <summary>
    /// The id of the round currently being played. Throws when the game has not
    /// been initialised.
    /// </summary>
    Task<int> GetActiveRoundIdAsync(CancellationToken cancellationToken = default);
}
