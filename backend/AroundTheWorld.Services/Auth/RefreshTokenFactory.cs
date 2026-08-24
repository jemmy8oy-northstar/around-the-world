using System.Security.Cryptography;
using System.Text;
using AroundTheWorld.Abstractions.Services.Auth;

namespace AroundTheWorld.Services.Auth;

public class RefreshTokenFactory : IRefreshTokenFactory
{
    /// <summary>256 bits of randomness, URL-safe so it survives being put in a header or JSON.</summary>
    public string Generate() => Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    /// <summary>
    /// A plain SHA-256, not a password hash. The input is 256 bits of cryptographic
    /// randomness rather than a guessable secret, so there is nothing for a slow
    /// KDF to defend against — and the lookup happens on every refresh.
    /// </summary>
    public string Hash(string refreshToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
