namespace AroundTheWorld.DataModels.Requests;

/// <summary>The admin's fix for a name that turned out to be a bad idea.</summary>
public class RenameUserRequest
{
    public required string NewUsername { get; set; }
}
