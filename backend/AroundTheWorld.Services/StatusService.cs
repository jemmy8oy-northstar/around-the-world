using AroundTheWorld.Abstractions.DataModels;
using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.DomainModels.Models;

namespace AroundTheWorld.Services;

public class StatusService : IStatusService
{
    public Task<IDomainStatus> GetSystemStatusAsync()
    {
        IDomainStatus model = new DomainStatus
        {
            Version = "1.1.0-alpha",
            LastUpdated = DateTime.UtcNow
        };

        return Task.FromResult(model);
    }
}
