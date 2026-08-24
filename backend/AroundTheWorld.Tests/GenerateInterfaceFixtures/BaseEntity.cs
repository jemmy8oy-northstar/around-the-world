using AroundTheWorld.Abstractions.Generation;

namespace AroundTheWorld.Tests.GenerateInterfaceFixtures;

/// <summary>A mirrored base class — see <see cref="DerivedEntity"/>.</summary>
[GenerateInterface]
public class BaseEntity : IBaseEntity
{
    public string Id { get; set; } = "";
}
