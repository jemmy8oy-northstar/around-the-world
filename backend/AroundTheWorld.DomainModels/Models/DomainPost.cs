using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.DataModels.Models;

namespace AroundTheWorld.DomainModels.Models;

public class DomainPost : Post, IDomainPost
{
    /// <summary>
    /// Drives feed filtering and never reaches the wire model — the AutoMapper
    /// profile drops it by construction, which is how the ban stays invisible.
    /// </summary>
    public bool AuthorIsShadowBanned { get; set; }
}
