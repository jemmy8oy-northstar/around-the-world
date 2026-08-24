using AroundTheWorld.Abstractions.DomainModels;
using AroundTheWorld.Abstractions.Exceptions;
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
    private readonly IUsernameClaimService usernameClaimService = Substitute.For<IUsernameClaimService>();
    private readonly IRefreshTokenRedeemer refreshTokenRedeemer = Substitute.For<IRefreshTokenRedeemer>();
    private readonly ISessionIssuer sessionIssuer = Substitute.For<ISessionIssuer>();

    private readonly AuthService authService;

    private static readonly IDomainUser Dave = new DomainUser { Id = Guid.NewGuid(), Username = "Dave" };

    public AuthServiceTests()
    {
        authService = new AuthService(
            partyCodeValidator, usernameClaimService, refreshTokenRedeemer, sessionIssuer);
    }

    [Fact]
    public async Task JoinAsync_validates_the_code_before_claiming_the_name()
    {
        partyCodeValidator.ValidateAsync("wrong", Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new UnauthorizedException("nope")));

        await Assert.ThrowsAsync<UnauthorizedException>(() => authService.JoinAsync("wrong", "Dave"));

        // The critical assertion: a bad code must not create a user row, or a
        // stranger could squat every name without ever getting in.
        await usernameClaimService.DidNotReceiveWithAnyArgs().ClaimAsync(default!, default);
        await sessionIssuer.DidNotReceiveWithAnyArgs().IssueAsync(default!, default);
    }

    [Fact]
    public async Task JoinAsync_does_not_issue_a_session_when_the_name_is_taken()
    {
        usernameClaimService.ClaimAsync("Dave", Arg.Any<CancellationToken>())
            .Returns(Task.FromException<IDomainUser>(new ConflictException("taken")));

        await Assert.ThrowsAsync<ConflictException>(() => authService.JoinAsync("260802", "Dave"));

        await sessionIssuer.DidNotReceiveWithAnyArgs().IssueAsync(default!, default);
    }

    [Fact]
    public async Task JoinAsync_issues_a_session_for_the_claimed_user()
    {
        usernameClaimService.ClaimAsync("Dave", Arg.Any<CancellationToken>()).Returns(Dave);

        await authService.JoinAsync("260802", "Dave");

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
