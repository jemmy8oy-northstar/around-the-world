using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.DataModels.Models;

namespace AroundTheWorld.DomainModels.Models;

public class DomainUser : User, IDomainUser
{
    /// <summary>
    /// Never leaves the server. The banned user's own experience is unchanged,
    /// so this must not appear on the wire in any form.
    /// </summary>
    public bool IsShadowBanned { get; set; }
}
