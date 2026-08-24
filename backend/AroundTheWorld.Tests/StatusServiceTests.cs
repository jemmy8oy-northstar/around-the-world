using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Services;

namespace AroundTheWorld.Tests;

/// <summary>
/// Unit-level smoke test for the sample service. Every scaffold ships with a green test
/// gate from commit one — replace/extend these as real domain services are added.
/// </summary>
public class StatusServiceTests
{
    [Fact]
    public async Task GetSystemStatusAsync_returns_a_populated_status()
    {
        var service = new StatusService();

        IDomainStatus status = await service.GetSystemStatusAsync();

        Assert.False(string.IsNullOrWhiteSpace(status.Version));
        Assert.Contains(status.Version, status.GetFriendlyStatus());
    }
}
