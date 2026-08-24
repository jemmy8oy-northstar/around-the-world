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
    }
}
