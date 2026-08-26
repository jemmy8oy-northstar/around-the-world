using AroundTheWorld.Database;
using AroundTheWorld.EntityModels.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.Extensions.DependencyInjection;

namespace AroundTheWorld.Tests.Database;

/// <summary>
/// Guards the one part of the schema no other test can see.
/// <para>
/// Every integration test boots on the InMemory provider, which calls
/// <c>EnsureCreated</c> and builds tables straight from the model — it never
/// replays a migration. So the whole <c>Migrations/</c> folder could be empty,
/// stale or wrong and all 180-odd of them would still pass, right up to the
/// point where the real Postgres deploy failed, or quietly ran without a column
/// and lost writes to it.
/// </para>
/// <para>
/// Written because <c>ChannelVisit</c> had to be hand-written (no EF tooling
/// available in the sandbox that produced it), and a hand-written migration has
/// three specific ways to be silently wrong: the <c>[Migration]</c> attribute
/// goes missing so EF never sees it; the <c>Up</c> forgets the column; or the
/// model snapshot is not updated, so the *next* migration is generated against a
/// stale baseline and quietly drops it.
/// </para>
/// </summary>
public class MigrationsTests
{
    /// <summary>
    /// A context on the real Postgres provider. Never connected — the
    /// connection string is deliberately nonsense, because everything asserted
    /// here is metadata that needs no database.
    /// </summary>
    private static ServiceProvider Services() =>
        new ServiceCollection()
            .AddDbContext<AppDbContext>(options =>
                options.UseNpgsql("Host=nowhere;Database=unused;Username=u;Password=p"))
            .BuildServiceProvider();

    private static IMigrationsAssembly MigrationsAssembly(IServiceScope scope) =>
        scope.ServiceProvider.GetRequiredService<AppDbContext>()
            .GetService<IMigrationsAssembly>();

    [Fact]
    public void Every_migration_is_discoverable_and_ordered()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();

        var migrations = MigrationsAssembly(scope).Migrations.Keys.ToList();

        // A migration class whose [Migration] attribute went missing is simply
        // absent from this list — it compiles, it sits in the folder, and its
        // column never reaches production.
        Assert.Contains("20260825234500_ChannelVisit", migrations);

        Assert.Equal(migrations.OrderBy(id => id, StringComparer.Ordinal), migrations);
    }

    [Fact]
    public void The_channel_visit_migration_adds_the_column_it_is_named_for()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();

        var assembly = MigrationsAssembly(scope);
        var migration = assembly.CreateMigration(
            assembly.Migrations["20260825234500_ChannelVisit"], activeProvider: "Npgsql.EntityFrameworkCore.PostgreSQL");

        var added = migration.UpOperations.OfType<AddColumnOperation>().ToList();

        var column = Assert.Single(added);
        Assert.Equal("ChannelVisitedAt", column.Name);
        Assert.Equal("Users", column.Table);

        // Nullable matters more than it looks: the column is added to a table
        // that already has rows on the night, and a NOT NULL column with no
        // default fails the migration outright — mid-deploy, on the birthday.
        Assert.True(column.IsNullable);

        // Every Up must be reversible or a bad deploy has no way back.
        Assert.Single(migration.DownOperations.OfType<DropColumnOperation>());
    }

    [Fact]
    public void The_model_snapshot_knows_about_the_column()
    {
        using var provider = Services();
        using var scope = provider.CreateScope();

        var snapshot = MigrationsAssembly(scope).ModelSnapshot;
        Assert.NotNull(snapshot);

        var user = snapshot!.Model.FindEntityType(typeof(UserEntity));
        Assert.NotNull(user);

        // The snapshot is the baseline the NEXT migration is generated against.
        // Leave it stale and EF believes the column does not exist, so the next
        // `migrations add` cheerfully emits an AddColumn for it a second time.
        var property = user!.FindProperty(nameof(UserEntity.ChannelVisitedAt));
        Assert.NotNull(property);
        Assert.True(property!.IsNullable);
    }
}
