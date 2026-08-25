namespace AroundTheWorld.Abstractions.DomainModels;

public interface IDomainAccessToken
{
    string Value { get; set; }

    DateTime ExpiresAt { get; set; }
}
