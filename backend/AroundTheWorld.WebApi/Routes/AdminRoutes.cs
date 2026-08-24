using AroundTheWorld.Abstractions.Services.Admin;
using AroundTheWorld.Abstractions.Services.Posts;
using AroundTheWorld.DataModels.Requests;
using AroundTheWorld.WebApi.Admin;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AroundTheWorld.WebApi.Routes;

public static class AdminRoutes
{
    public static RouteGroupBuilder MapAdminRoutes(this RouteGroupBuilder parentGroup)
    {
        // Anonymous but key-gated: the admin page is used from a phone that may not
        // have joined the game, so it must not also require a player token.
        var group = parentGroup.MapGroup("/admin")
            .AllowAnonymous()
            .AddEndpointFilter<AdminKeyEndpointFilter>()
            .WithTags("Admin");

        group.MapPost("/stop/next", AdvanceStop).WithName("AdvancePubStop");
        group.MapPost("/round", StartRound).WithName("StartNewRound");
        group.MapPut("/settings", UpdateCutovers).WithName("UpdateCutovers");
        group.MapPost("/users/{username}/ban", SetShadowBan).WithName("SetShadowBan");
        group.MapPost("/users/{username}/release", ReleaseUsername).WithName("ReleaseUsername");
        group.MapDelete("/posts/{postId:guid}", DeleteAnyPost).WithName("AdminDeletePost");

        return parentGroup;
    }

    private static async Task<Ok<int>> AdvanceStop(
        IPubStopService pubStopService,
        CancellationToken cancellationToken) =>
        TypedResults.Ok(await pubStopService.AdvanceAsync(cancellationToken));

    private static async Task<Ok<int>> StartRound(
        StartRoundRequest request,
        IRoundService roundService,
        CancellationToken cancellationToken) =>
        TypedResults.Ok(await roundService.StartNewRoundAsync(request.Name, cancellationToken));

    private static async Task<NoContent> UpdateCutovers(
        UpdateCutoversRequest request,
        IGameSettingsService gameSettingsService,
        CancellationToken cancellationToken)
    {
        await gameSettingsService.UpdateCutoversAsync(request.GoLiveAt, request.ReadOnlyAt, cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<NoContent> SetShadowBan(
        string username,
        ShadowBanRequest request,
        IUserModerationService userModerationService,
        CancellationToken cancellationToken)
    {
        await userModerationService.SetShadowBanAsync(username, request.IsShadowBanned, cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<NoContent> ReleaseUsername(
        string username,
        IUserModerationService userModerationService,
        CancellationToken cancellationToken)
    {
        await userModerationService.ReleaseUsernameAsync(username, cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<NoContent> DeleteAnyPost(
        Guid postId,
        IPostDeletionService postDeletionService,
        CancellationToken cancellationToken)
    {
        await postDeletionService.DeleteAsync(postId, Guid.Empty, isAdmin: true, cancellationToken);
        return TypedResults.NoContent();
    }
}
