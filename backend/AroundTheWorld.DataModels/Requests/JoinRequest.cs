namespace AroundTheWorld.DataModels.Requests;

/// <summary>The whole sign-up: a name you pick.</summary>
public class JoinRequest
{
    /// <summary>
    /// Optional, and ignored for every name except the host's. It exists so the
    /// host can claim a name that would otherwise hand the admin panel to whoever
    /// typed it first.
    /// </summary>
    public string? PartyCode { get; set; }

    public required string Username { get; set; }
}
