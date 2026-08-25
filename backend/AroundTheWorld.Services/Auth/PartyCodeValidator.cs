using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services.Auth;
using AroundTheWorld.Database;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Services.Auth;

public class PartyCodeValidator(AppDbContext dbContext) : IPartyCodeValidator
{
    public async Task ValidateAsync(string? partyCode, CancellationToken cancellationToken = default)
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
            // 403 rather than 401 on purpose. A 401 means "authenticate and try
            // again", and the frontend's baseQuery answers one by spending the
            // refresh token — which a visitor sitting on the join screen does not
            // have. 403 says what is true: you may not claim this particular name.
            throw new ForbiddenException("That name is the host's. Enter the host code to claim it.");
        }
    }
}
