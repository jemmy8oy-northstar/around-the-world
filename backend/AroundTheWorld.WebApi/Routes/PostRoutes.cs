using System.Security.Claims;
using AroundTheWorld.Abstractions.Services.Posts;
using AroundTheWorld.DataModels.Models;
using AroundTheWorld.WebApi.Admin;
using AutoMapper;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace AroundTheWorld.WebApi.Routes;

public static class PostRoutes
{
    public static RouteGroupBuilder MapPostRoutes(this RouteGroupBuilder parentGroup)
    {
        var group = parentGroup.MapGroup("/posts").RequireAuthorization();

        group.MapGet("", GetFeed)
            .WithName("GetPosts")
            .WithSummary("The active round's feed, newest first. Filter with ?country=XX.");

        group.MapPost("", CreatePost)
            .WithName("CreatePost")
            .WithSummary("Post a drink: photo, caption and the country it's from.")
            .DisableAntiforgery()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden);

        group.MapDelete("/{postId:guid}", DeletePost)
            .WithName("DeletePost")
            .WithSummary("Soft-deletes your own post.")
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound);

        return parentGroup;
    }

    private static async Task<Ok<List<Post>>> GetFeed(
        ClaimsPrincipal principal,
        IPostFeedService postFeedService,
        IMapper mapper,
        CancellationToken cancellationToken,
        [FromQuery] string? country = null)
    {
        var posts = await postFeedService.GetFeedAsync(
            CurrentUser.IdFrom(principal), country, cancellationToken);

        return TypedResults.Ok(posts.Select(mapper.Map<Post>).ToList());
    }

    private static async Task<Created<Post>> CreatePost(
        ClaimsPrincipal principal,
        IFormFile photo,
        [FromForm] string caption,
        [FromForm] string countryCode,
        IPostCreationService postCreationService,
        IMapper mapper,
        CancellationToken cancellationToken)
    {
        await using var stream = photo.OpenReadStream();

        var post = await postCreationService.CreateAsync(
            CurrentUser.IdFrom(principal),
            stream,
            photo.ContentType,
            photo.Length,
            caption,
            countryCode,
            cancellationToken);

        var created = mapper.Map<Post>(post);
        return TypedResults.Created($"/api/posts/{created.Id}", created);
    }

    private static async Task<NoContent> DeletePost(
        Guid postId,
        ClaimsPrincipal principal,
        IPostDeletionService postDeletionService,
        CancellationToken cancellationToken)
    {
        await postDeletionService.DeleteAsync(
            postId, CurrentUser.IdFrom(principal), isAdmin: false, cancellationToken);

        return TypedResults.NoContent();
    }
}
