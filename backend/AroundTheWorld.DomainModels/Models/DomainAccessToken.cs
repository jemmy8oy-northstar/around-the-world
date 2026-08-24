using AroundTheWorld.Abstractions.DomainModels;

namespace AroundTheWorld.DomainModels.Models;

public class DomainAccessToken : IDomainAccessToken
{
    public required string Value { get; set; }

    public DateTime ExpiresAt { get; set; }
}
