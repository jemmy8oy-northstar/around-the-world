namespace AroundTheWorld.Abstractions.Services.Auth;

/// <summary>
/// Creates opaque refresh tokens and the hashes they are stored as. The token
/// itself never reaches the database.
/// </summary>
public interface IRefreshTokenFactory
{
    string Generate();

    string Hash(string refreshToken);
}
