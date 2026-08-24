using AroundTheWorld.EntityModels.Entities;
using Microsoft.EntityFrameworkCore;

namespace AroundTheWorld.Database;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    /// <summary>The singleton settings row. Always exactly one, with <c>Id = 1</c>.</summary>
    public DbSet<GameSettingsEntity> GameSettings => Set<GameSettingsEntity>();

    public DbSet<RoundEntity> Rounds => Set<RoundEntity>();

    public DbSet<UserEntity> Users => Set<UserEntity>();

    public DbSet<SessionEntity> Sessions => Set<SessionEntity>();

    public DbSet<PostEntity> Posts => Set<PostEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<GameSettingsEntity>(entity =>
        {
            entity.Property(e => e.PartyCode).HasMaxLength(32);

            // No cascade: ending a round must never be able to take the settings row
            // with it, and the active round is re-pointed rather than removed.
            entity.HasOne(e => e.ActiveRound)
                .WithMany()
                .HasForeignKey(e => e.ActiveRoundId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RoundEntity>(entity =>
        {
            entity.Property(e => e.Name).HasMaxLength(80);

            // Exactly one round may be open at a time — the "reset" closes the old
            // one in the same transaction as it opens the new one. Enforced in the
            // database so a double-tap on the admin button cannot fork the game.
            entity.HasIndex(e => e.EndedAt)
                .IsUnique()
                .HasFilter("\"EndedAt\" IS NULL");
        });

        modelBuilder.Entity<UserEntity>(entity =>
        {
            entity.Property(e => e.Username).HasMaxLength(32);
            entity.Property(e => e.UsernameNormalised).HasMaxLength(32);
            // Filtered so a released name becomes claimable again without having
            // to delete the user row and orphan their posts.
            entity.HasIndex(e => e.UsernameNormalised)
                .IsUnique()
                .HasFilter("\"ReleasedAt\" IS NULL");
        });

        modelBuilder.Entity<SessionEntity>(entity =>
        {
            entity.Property(e => e.RefreshTokenHash).HasMaxLength(64);
            entity.HasIndex(e => e.RefreshTokenHash);

            entity.HasOne(e => e.User)
                .WithMany(u => u.Sessions)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PostEntity>(entity =>
        {
            entity.Property(e => e.Caption).HasMaxLength(280);
            entity.Property(e => e.CountryCode).HasMaxLength(2).IsFixedLength();
            entity.Property(e => e.PhotoKey).HasMaxLength(200);

            // The feed query: active round, not deleted, newest first.
            entity.HasIndex(e => new { e.RoundId, e.IsDeleted, e.CreatedAt });

            // The map/leaderboard aggregation.
            entity.HasIndex(e => new { e.RoundId, e.CountryCode });

            entity.HasOne(e => e.Round)
                .WithMany(r => r.Posts)
                .HasForeignKey(e => e.RoundId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.User)
                .WithMany(u => u.Posts)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
