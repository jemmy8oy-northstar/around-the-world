namespace AroundTheWorld.Abstractions.Services.Admin;

public interface IPubStopService
{
    /// <summary>Moves the group on to the next pub. Returns the new stop number.</summary>
    Task<int> AdvanceAsync(CancellationToken cancellationToken = default);
}
