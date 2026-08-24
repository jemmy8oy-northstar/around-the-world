using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Database;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AroundTheWorld.Tests;

/// <summary>
/// Boots the real WebApi in-process against a fresh in-memory database, so route
/// tests exercise routing, DI, model binding, serialisation and exception handling
/// end-to-end without a test database. Each instance gets its own store, so tests
/// never share state.
/// </summary>
/// <remarks>
/// The "Testing" environment stops appsettings.Development.json being read — with
/// it loaded both Npgsql and InMemory would register and EF refuses more than one
/// provider. Program.cs branches on <c>Database.IsRelational()</c> so the InMemory
/// provider gets EnsureCreated instead of Migrate.
/// </remarks>
public sealed class GameApiFactory : WebApplicationFactory<Program>
{
    private readonly string databaseName = Guid.NewGuid().ToString();
    private readonly Action<IServiceCollection>? configureServices;

    public GameApiFactory(Action<IServiceCollection>? configureServices = null)
    {
        this.configureServices = configureServices;
    }

    /// <summary>Time as the booted app sees it. Tests move this to cross a cutover.</summary>
    public TestClock Clock { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(databaseName));
            services.AddSingleton<IClock>(Clock);
            configureServices?.Invoke(services);
        });
    }

    /// <summary>Runs an assertion or arrangement directly against the seeded database.</summary>
    public async Task WithDbAsync(Func<AppDbContext, Task> action)
    {
        using var scope = Services.CreateScope();
        await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }
}
