namespace AroundTheWorld.DataModels.Requests;

public class StartRoundRequest
{
    /// <summary>Optional. Defaults to "Round N".</summary>
    public string? Name { get; set; }
}
