namespace AroundTheWorld.Abstractions.Services.Auth;

public interface IPartyCodeValidator
{
    /// <summary>Throws when the supplied code is not the current party code.</summary>
    Task ValidateAsync(string partyCode, CancellationToken cancellationToken = default);
}
