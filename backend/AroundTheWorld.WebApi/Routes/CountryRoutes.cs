using System.Security.Claims;
using AroundTheWorld.Abstractions.Services.Posts;
using AroundTheWorld.DataModels.Models;
using AroundTheWorld.WebApi.Admin;
using AutoMapper;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AroundTheWorld.WebApi.Routes;

public static class CountryRoutes
{
    public static RouteGroupBuilder MapCountryRoutes(this RouteGroupBuilder parentGroup)
    {
        var group = parentGroup.MapGroup("/countries").RequireAuthorization();

        group.MapGet("", GetTally)
            .WithName("GetCountryTally")
            .WithSummary("Post counts per country — the map badges and the leaderboard.");

        return parentGroup;
    }

    private static async Task<Ok<List<CountryTally>>> GetTally(
        ClaimsPrincipal principal,
        ICountryTallyService countryTallyService,
        IMapper mapper,
        CancellationToken cancellationToken)
    {
        var tally = await countryTallyService.GetTallyAsync(
            CurrentUser.IdFrom(principal), cancellationToken);

        return TypedResults.Ok(tally.Select(mapper.Map<CountryTally>).ToList());
    }
}
