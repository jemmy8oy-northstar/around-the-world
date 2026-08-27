using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Exceptions;
using AroundTheWorld.Abstractions.Services.Admin;
using AroundTheWorld.Abstractions.Services.Auth;
using AroundTheWorld.DomainModels.Models;
using AroundTheWorld.Services.Auth;
using NSubstitute;

namespace AroundTheWorld.Tests.Auth;

/// <summary>
/// The orchestrator holds no logic, so these tests assert the one thing it is
/// responsible for: that the steps run in the right order and a failure at any
/// step stops the ones after it.
/// </summary>
public class AuthServiceTests
{
    private readonly IPartyCodeValidator partyCodeValidator = Substitute.For<IPartyCodeValidator>();
    private readonly IAdminIdentity adminIdentity = Substitute.For<IAdminIdentity>();
    private readonly IUsernameClaimService usernameClaimService = Substitute.For<IUsernameClaimService>();
    private readonly IRefreshTokenRedeemer refreshTokenRedeemer = Substitute.For<IRefreshTokenRedeemer>();
    private readonly ISessionIssuer sessionIssuer = Substitute.For<ISessionIssuer>();

    private readonly AuthService authService;

    private static readonly IDomainUser Dave = new DomainUser { Id = Guid.NewGuid(), Username = "Dave" };

    public AuthServiceTests()
    {
        // "james" is the host; everyone else is an ordinary guest.
        adminIdentity.IsAdmin(Arg.Any<string?>()).Returns(false);
        adminIdentity.IsAdmin("james").Returns(true);

        authService = new AuthService(
            partyCodeValidator, adminIdentity, usernameClaimService, refreshTokenRedeemer, sessionIssuer);
    }

    [Fact]
    public async Task JoinAsync_does_not_ask_a_guest_for_a_code_at_all()
    {
        usernameClaimService.ClaimAsync("Dave", Arg.Any<CancellationToken>()).Returns(Dave);

        await authService.JoinAsync(partyCode: null, "Dave");

        // The point of the whole change: a guest types a name and is in.
        await partyCodeValidator.DidNotReceiveWithAnyArgs().ValidateAsync(default, default);
        await sessionIssuer.Received(1).IssueAsync(Dave, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task JoinAsync_validates_the_code_before_letting_anyone_be_the_host()
    {
        partyCodeValidator.ValidateAsync("wrong", Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new ForbiddenException("nope")));

        await Assert.ThrowsAsync<ForbiddenException>(() => authService.JoinAsync("wrong", "james"));

        // The critical assertion: a failed host claim must not create the user
        // row, or the name is squatted and the real host is locked out of the
        // admin panel for the night.
        await usernameClaimService.DidNotReceiveWithAnyArgs().ClaimAsync(default!, default);
        await sessionIssuer.DidNotReceiveWithAnyArgs().IssueAsync(default!, default);
    }

    [Fact]
    public async Task JoinAsync_lets_the_host_in_with_the_code()
    {
        var james = new DomainUser { Id = Guid.NewGuid(), Username = "james" };
        usernameClaimService.ClaimAsync("james", Arg.Any<CancellationToken>()).Returns(james);

        await authService.JoinAsync("260802", "james");

        await partyCodeValidator.Received(1).ValidateAsync("260802", Arg.Any<CancellationToken>());
        await sessionIssuer.Received(1).IssueAsync(james, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task JoinAsync_does_not_issue_a_session_when_the_name_is_taken()
    {
        usernameClaimService.ClaimAsync("Dave", Arg.Any<CancellationToken>())
            .Returns(Task.FromException<IDomainUser>(new ConflictException("taken")));

        await Assert.ThrowsAsync<ConflictException>(() => authService.JoinAsync(null, "Dave"));

        await sessionIssuer.DidNotReceiveWithAnyArgs().IssueAsync(default!, default);
    }

    [Fact]
    public async Task JoinAsync_issues_a_session_for_the_claimed_user()
    {
        usernameClaimService.ClaimAsync("Dave", Arg.Any<CancellationToken>()).Returns(Dave);

        await authService.JoinAsync(null, "Dave");

        await sessionIssuer.Received(1).IssueAsync(Dave, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RefreshAsync_issues_a_session_for_the_token_owner()
    {
        refreshTokenRedeemer.RedeemAsync("token", Arg.Any<CancellationToken>()).Returns(Dave);

        await authService.RefreshAsync("token");

        await sessionIssuer.Received(1).IssueAsync(Dave, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RefreshAsync_does_not_issue_a_session_for_a_bad_token()
    {
        refreshTokenRedeemer.RedeemAsync("bad", Arg.Any<CancellationToken>())
            .Returns(Task.FromException<IDomainUser>(new UnauthorizedException("expired")));

        await Assert.ThrowsAsync<UnauthorizedException>(() => authService.RefreshAsync("bad"));

        await sessionIssuer.DidNotReceiveWithAnyArgs().IssueAsync(default!, default);
    }
}
