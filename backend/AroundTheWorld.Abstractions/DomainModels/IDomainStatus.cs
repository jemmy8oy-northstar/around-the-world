namespace AroundTheWorld.Abstractions.DomainModels;

using AroundTheWorld.Abstractions.DataModels;

public interface IDomainStatus : IStatus
{
    string GetFriendlyStatus();
}
