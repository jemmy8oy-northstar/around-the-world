using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.DataModels.Models;
using AutoMapper;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AroundTheWorld.WebApi.Routes;

public static class GameRoutes
{
    public static RouteGroupBuilder MapGameRoutes(this RouteGroupBuilder parentGroup)
    {
        var group = parentGroup.MapGroup("/game");

        group.MapGet("", GetGameState)
            .WithName("GetGameState")
            .WithSummary("Current game mode, active round and pub stop.")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return parentGroup;
    }

    /// <summary>
    /// Anonymous on purpose: the join screen needs to show the countdown and the
    /// read-only state before anyone has a token.
    /// </summary>
    private static async Task<Ok<GameState>> GetGameState(
        IGameService gameService,
        IMapper mapper,
        CancellationToken cancellationToken)
    {
        var state = await gameService.GetStateAsync(cancellationToken);
        return TypedResults.Ok(mapper.Map<GameState>(state));
    }
}
