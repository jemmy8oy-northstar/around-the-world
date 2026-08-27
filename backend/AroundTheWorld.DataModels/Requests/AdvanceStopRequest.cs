namespace AroundTheWorld.DataModels.Requests;

public class AdvanceStopRequest
{
    /// <summary>
    /// Optional. True to advance even though the last one was under five minutes
    /// ago — sent only after the admin has answered the confirmation, so a
    /// double-tap can never produce it.
    /// </summary>
    public bool Force { get; set; }
}
