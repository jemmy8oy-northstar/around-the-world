using AroundTheWorld.Abstractions.DataModels;

namespace AroundTheWorld.Abstractions.DomainModels;

public interface IDomainPost : IPost
{
    /// <summary>Server-side only — never mapped onto the wire model.</summary>
    bool AuthorIsShadowBanned { get; set; }
}
