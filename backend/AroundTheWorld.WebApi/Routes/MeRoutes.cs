using System.Security.Claims;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.WebApi.Admin;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AroundTheWorld.WebApi.Routes;

public static class MeRoutes
{
    public static RouteGroupBuilder MapMeRoutes(this RouteGroupBuilder parentGroup)
    {
        var group = parentGroup.MapGroup("/me").RequireAuthorization();

        group.MapPost("/channel-visit", RecordChannelVisit)
            .WithName("RecordChannelVisit")
            .WithSummary("Records that you tapped through to the YouTube channel.")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return parentGroup;
    }

    /// <summary>
    /// The user id comes from the token, never from the body — otherwise anyone
    /// could award the badge to anyone, which is a small thing that would ruin
    /// the joke.
    /// </summary>
    private static async Task<NoContent> RecordChannelVisit(
        ClaimsPrincipal principal,
        IChannelVisitService channelVisitService,
        CancellationToken cancellationToken)
    {
        await channelVisitService.RecordAsync(CurrentUser.IdFrom(principal), cancellationToken);
        return TypedResults.NoContent();
    }
}
