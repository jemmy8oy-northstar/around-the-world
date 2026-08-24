using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services.Auth;
using AroundTheWorld.Database;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Auth;

public class PartyCodeValidator(AppDbContext dbContext) : IPartyCodeValidator
{
    public async Task ValidateAsync(string partyCode, CancellationToken cancellationToken = default)
    {
        var expected = await dbContext.GameSettings
            .AsNoTracking()
            .Select(s => s.PartyCode)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("The game has not been initialised.");

        // Trimmed and case-insensitive: the code gets read off a card in a dim pub
        // and typed with a phone keyboard that likes to capitalise things.
        if (!string.Equals(partyCode?.Trim(), expected, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedException("That party code is not right.");
        }
    }
}
