using AroundTheWorld.Abstractions.DataModels;

namespace AroundTheWorld.DataModels.Models;

public class User : IUser
{
    public Guid Id { get; set; }

    public required string Username { get; set; }
}
