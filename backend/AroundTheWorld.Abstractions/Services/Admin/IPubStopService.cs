namespace AroundTheWorld.Abstractions.Services.Admin;

public interface IPubStopService
{
    /// <summary>Moves the group on to the next pub. Returns the new stop number.</summary>
    /// <param name="force">
    /// Skips the minimum gap between advances. Set only once the admin has
    /// confirmed a second advance inside the cooldown — the refusal is a question,
    /// not a lock.
    /// </param>
    Task<int> AdvanceAsync(bool force = false, CancellationToken cancellationToken = default);
}
