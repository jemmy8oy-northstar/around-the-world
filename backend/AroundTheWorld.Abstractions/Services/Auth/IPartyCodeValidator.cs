namespace AroundTheWorld.Abstractions.Services.Auth;

public interface IPartyCodeValidator
{
    /// <summary>
    /// Throws when the supplied code is not the current host code. Since the code
    /// stopped gating the party it guards one thing: claiming the host's name.
    /// </summary>
    Task ValidateAsync(string? partyCode, CancellationToken cancellationToken = default);
}
