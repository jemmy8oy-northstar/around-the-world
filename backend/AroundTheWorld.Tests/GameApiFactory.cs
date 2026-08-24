using AroundTheWorld.Database;
using Microsoft.Extensions.Time.Testing;
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
    /// <summary>The admin key the booted host is configured with.</summary>
    public const string AdminKey = "test-admin-key";

    private readonly string databaseName = Guid.NewGuid().ToString();
    private readonly Action<IServiceCollection>? configureServices;

    /// <param name="startAt">
    /// When the booted app believes it is. FakeTimeProvider refuses to move
    /// backwards, so a test that needs an earlier instant sets it here rather than
    /// rewinding later. Defaults to inside the live window of the seeded game.
    /// </param>
    public GameApiFactory(
        Action<IServiceCollection>? configureServices = null,
        DateTimeOffset? startAt = null)
    {
        this.configureServices = configureServices;
        Clock = new FakeTimeProvider(startAt ?? new DateTimeOffset(2026, 8, 28, 20, 0, 0, TimeSpan.Zero));
    }

    /// <summary>
    /// Time as the booted app sees it — including the JWT bearer handler, so a
    /// token issued here is valid here. Tests move this to cross a cutover.
    /// Defaults to a moment inside the live window of the seeded game.
    /// </summary>
    public FakeTimeProvider Clock { get; }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        // The Testing environment deliberately skips appsettings.Development.json,
        // so the signing key has to be supplied here or every booted host would
        // mint its own ephemeral one and tokens would not verify.
        builder.UseSetting("Jwt:Secret", "test-signing-key-that-is-long-enough-for-hmac-sha256");
        builder.UseSetting("Admin:Key", AdminKey);

        // Keeps uploaded test photos out of the repository and out of each other's way.
        builder.UseSetting(
            "PhotoStorage:LocalRootPath",
            Path.Combine(Path.GetTempPath(), $"atw-test-{Guid.NewGuid():N}"));

        builder.ConfigureServices(services =>
        {
            services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(databaseName));
            services.AddSingleton<TimeProvider>(Clock);
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
