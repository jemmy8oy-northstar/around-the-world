using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.DataModels.Models;

namespace AroundTheWorld.DomainModels.Models;

public class DomainStatus : Status, IDomainStatus
{
    public string GetFriendlyStatus()
    {
        return $"System is running version {Version} (Updated: {LastUpdated:g})";
    }
}
