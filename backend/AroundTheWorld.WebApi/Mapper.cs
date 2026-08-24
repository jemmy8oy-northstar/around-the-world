using AroundTheWorld.DataModels.Models;
using AroundTheWorld.DomainModels.Models;
using AutoMapper;

namespace AroundTheWorld.WebApi;

/// <summary>
/// The API boundary: rich domain objects down to the flat shapes the OpenAPI
/// document describes. Entity-to-domain mapping lives in Services/Mapper.cs.
/// </summary>
public class Mapper : Profile
{
    public Mapper()
    {
        CreateMap<DomainGameState, GameState>();

        // Drops IsShadowBanned by construction — the wire model has no such field,
        // which is exactly how a shadow ban stays invisible to the person banned.
        CreateMap<DomainAuthSession, AuthSession>();
        CreateMap<DomainUser, User>();

        // AuthorIsShadowBanned has no counterpart on Post, so it is dropped here
        // by construction rather than by remembering to exclude it.
        CreateMap<DomainPost, Post>();
        CreateMap<DomainCountryTally, CountryTally>();
    }
}
