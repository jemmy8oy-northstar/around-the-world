using AroundTheWorld.Abstractions.Generation;

namespace AroundTheWorld.Tests.GenerateInterfaceFixtures;

/// <summary>
/// The domain model. Reached through <see cref="IDomainPerson"/>, its Address
/// is a <see cref="DomainAddr"/> — the narrowing that a plain base class
/// cannot express, because a property type cannot be overridden.
/// </summary>
[GenerateInterface]
public class DomainPerson : PersonBase<DomainAddr>, IDomainPerson
{
}
