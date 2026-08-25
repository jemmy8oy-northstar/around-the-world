using AroundTheWorld.Abstractions.Services.Auth;
using AroundTheWorld.DataModels.Models;
using AroundTheWorld.DataModels.Requests;
using AutoMapper;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AroundTheWorld.WebApi.Routes;

public static class AuthRoutes
{
    public static RouteGroupBuilder MapAuthRoutes(this RouteGroupBuilder parentGroup)
    {
        var group = parentGroup.MapGroup("/auth").AllowAnonymous();

        group.MapPost("/join", Join)
            .WithName("Join")
            .WithSummary("Exchange a username for a token pair. The host's name also needs the host code.")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/refresh", Refresh)
            .WithName("Refresh")
            .WithSummary("Redeem a refresh token for a fresh pair.")
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        return parentGroup;
    }

    private static async Task<Ok<AuthSession>> Join(
        JoinRequest request,
        IAuthService authService,
        IMapper mapper,
        CancellationToken cancellationToken)
    {
        var session = await authService.JoinAsync(request.PartyCode, request.Username, cancellationToken);
        return TypedResults.Ok(mapper.Map<AuthSession>(session));
    }

    private static async Task<Ok<AuthSession>> Refresh(
        RefreshRequest request,
        IAuthService authService,
        IMapper mapper,
        CancellationToken cancellationToken)
    {
        var session = await authService.RefreshAsync(request.RefreshToken, cancellationToken);
        return TypedResults.Ok(mapper.Map<AuthSession>(session));
    }
}
