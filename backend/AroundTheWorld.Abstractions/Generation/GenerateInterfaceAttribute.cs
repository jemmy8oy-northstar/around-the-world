namespace AroundTheWorld.Abstractions.Generation;

/// <summary>
/// Marks a concrete class whose public surface should be mirrored into an
/// interface by <c>AroundTheWorld.SourceGenerators</c>.
/// </summary>
/// <remarks>
/// The generator emits <c>I{ClassName}</c> beside the class, in the same
/// namespace. It does <em>not</em> add the interface to the class's base list —
/// write <c>: IMyClass</c> yourself, so the implements-relationship stays
/// visible in the source you read. The class does not need to be
/// <c>partial</c>: the generator writes a separate file and never modifies it.
/// </remarks>
[AttributeUsage(AttributeTargets.Class, Inherited = false, AllowMultiple = false)]
public sealed class GenerateInterfaceAttribute : Attribute
{
}
