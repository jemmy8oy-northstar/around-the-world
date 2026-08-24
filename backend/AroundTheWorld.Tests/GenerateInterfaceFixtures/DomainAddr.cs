using AroundTheWorld.Abstractions.Generation;

namespace AroundTheWorld.Tests.GenerateInterfaceFixtures;

/// <summary>The domain counterpart of <see cref="Addr"/>, adding behaviour.</summary>
[GenerateInterface]
public class DomainAddr : Addr, IDomainAddr
{
    public string Normalised() => Line1.ToUpperInvariant();
}
