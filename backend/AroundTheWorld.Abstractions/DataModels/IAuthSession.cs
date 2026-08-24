namespace AroundTheWorld.Abstractions.DataModels;

public interface IAuthSession
{
    string AccessToken { get; set; }

    DateTime AccessTokenExpiresAt { get; set; }

    /// <summary>Opaque. Only ever stored hashed server-side.</summary>
    string RefreshToken { get; set; }

    Guid UserId { get; set; }

    string Username { get; set; }
}
