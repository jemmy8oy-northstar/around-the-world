using System.Text.RegularExpressions;
using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Auth;
using AroundTheWorld.Database;
using AroundTheWorld.DomainModels.Models;
using AroundTheWorld.EntityModels.Entities;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Auth;

public partial class UsernameClaimService(AppDbContext dbContext, IClock clock) : IUsernameClaimService
{
    private const int MinimumLength = 2;
    private const int MaximumLength = 32;

    public async Task<IDomainUser> ClaimAsync(string username, CancellationToken cancellationToken = default)
    {
        var trimmed = (username ?? string.Empty).Trim();

        if (trimmed.Length is < MinimumLength or > MaximumLength)
        {
            throw new ValidationException($"Pick a name between {MinimumLength} and {MaximumLength} characters.");
        }

        if (!AllowedUsername().IsMatch(trimmed))
        {
            throw new ValidationException("Names can use letters, numbers, spaces, hyphens and underscores.");
        }

        var normalised = trimmed.ToLowerInvariant();

        if (await dbContext.Users.AnyAsync(u => u.UsernameNormalised == normalised, cancellationToken))
        {
            // Deliberately not "log them in as that user": the feed's whole value is
            // that a post attributed to someone was made by them. An admin releases
            // the name when someone genuinely changes phone.
            throw new ConflictException($"\"{trimmed}\" is already taken — pick another name.");
        }

        var user = new UserEntity
        {
            Id = Guid.NewGuid(),
            Username = trimmed,
            UsernameNormalised = normalised,
            CreatedAt = clock.UtcNow,
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new DomainUser
        {
            Id = user.Id,
            Username = user.Username,
            IsShadowBanned = user.IsShadowBanned,
        };
    }

    [GeneratedRegex(@"^[\p{L}\p{N} _-]+$")]
    private static partial Regex AllowedUsername();
}
