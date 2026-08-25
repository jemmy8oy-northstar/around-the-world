using AroundTheWorld.Services.Auth;

namespace AroundTheWorld.Tests.Auth;

public class RefreshTokenFactoryTests
{
    private readonly RefreshTokenFactory factory = new();

    [Fact]
    public void Generate_returns_a_distinct_token_each_time()
    {
        var tokens = Enumerable.Range(0, 200).Select(_ => factory.Generate()).ToHashSet();

        Assert.Equal(200, tokens.Count);
    }

    [Fact]
    public void Generate_returns_a_url_safe_token()
    {
        var token = factory.Generate();

        Assert.DoesNotContain('+', token);
        Assert.DoesNotContain('/', token);
        Assert.DoesNotContain('=', token);
    }

    [Fact]
    public void Hash_is_deterministic()
    {
        var token = factory.Generate();

        Assert.Equal(factory.Hash(token), factory.Hash(token));
    }

    [Fact]
    public void Hash_does_not_contain_the_token()
    {
        var token = factory.Generate();

        Assert.DoesNotContain(token, factory.Hash(token));
    }

    [Fact]
    public void Hash_differs_for_different_tokens()
    {
        Assert.NotEqual(factory.Hash(factory.Generate()), factory.Hash(factory.Generate()));
    }
}
