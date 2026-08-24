using AroundTheWorld.Abstractions.DataModels;
using AroundTheWorld.Abstractions.DomainModels;

namespace AroundTheWorld.Abstractions.Services;

public interface IStatusService
{
    Task<IDomainStatus> GetSystemStatusAsync();
}
