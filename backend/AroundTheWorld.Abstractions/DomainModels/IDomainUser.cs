using AroundTheWorld.Abstractions.DataModels;

namespace AroundTheWorld.Abstractions.DomainModels;

public interface IDomainUser : IUser
{
    bool IsShadowBanned { get; set; }
}
