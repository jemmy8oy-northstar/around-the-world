using AroundTheWorld.Abstractions.Generation;

namespace AroundTheWorld.Tests.GenerateInterfaceFixtures;

/// <summary>
/// Its base is mirrored too, so IDerivedEntity should INHERIT IBaseEntity and
/// declare only what this class adds.
/// </summary>
[GenerateInterface]
public class DerivedEntity : BaseEntity, IDerivedEntity
{
    public string Extra { get; set; } = "";
}
