using AroundTheWorld.Abstractions.Generation;

namespace AroundTheWorld.Tests.GenerateInterfaceFixtures;

/// <summary>
/// Its base is not mirrored, so IDerivedFromUnmarked must declare the
/// inherited members too — otherwise the interface is an incomplete view of
/// the class.
/// </summary>
[GenerateInterface]
public class DerivedFromUnmarked : UnmarkedBase, IDerivedFromUnmarked
{
    public string Own { get; set; } = "";
}
