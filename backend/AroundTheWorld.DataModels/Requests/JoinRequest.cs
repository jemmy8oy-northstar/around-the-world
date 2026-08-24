namespace AroundTheWorld.DataModels.Requests;

/// <summary>The whole sign-up: a shared code and a name you pick.</summary>
public class JoinRequest
{
    public required string PartyCode { get; set; }

    public required string Username { get; set; }
}
