namespace AroundTheWorld.Abstractions.DataModels;

public interface IUser
{
    Guid Id { get; set; }

    string Username { get; set; }
}
