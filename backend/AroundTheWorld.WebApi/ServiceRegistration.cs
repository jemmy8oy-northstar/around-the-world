using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Admin;
using AroundTheWorld.Abstractions.Services.Auth;
using AroundTheWorld.Abstractions.Services.Countries;
using AroundTheWorld.Abstractions.Services.Posts;
using AroundTheWorld.Services;
using AroundTheWorld.Services.Admin;
using AroundTheWorld.Services.Auth;
using AroundTheWorld.Services.Countries;
using AroundTheWorld.Services.Posts;
using AroundTheWorld.WebApi.Authentication;
using AroundTheWorld.WebApi.Photos;
using AroundTheWorld.Services.Configuration;
using AroundTheWorld.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace AroundTheWorld.WebApi;

public static class ServiceRegistration
{
    public static void AddBackendServices(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            Console.WriteLine("[WARNING] No database connection string configured — database features are disabled.");
        }
        else
        {
            services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(connectionString, b => b.MigrationsAssembly("AroundTheWorld.Database")));
        }

        services.Configure<GameOptions>(configuration.GetSection(GameOptions.SectionName));
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<PhotoStorageOptions>(configuration.GetSection(PhotoStorageOptions.SectionName));
        services.Configure<AdminOptions>(configuration.GetSection(AdminOptions.SectionName));

        services.AddPhotoStorage(configuration);

        services.AddJwtAuthentication(configuration);

        services.AddAutoMapper(cfg => cfg.AddMaps(AppDomain.CurrentDomain.GetAssemblies()));

        // The one clock. Registered rather than read statically so both the app's
        // own time-dependent logic and the JWT bearer handler's lifetime validation
        // move together — otherwise tokens are issued on one clock and validated on
        // another, and a token can arrive already "not yet valid".
        services.TryAddSingleton(TimeProvider.System);
        services.AddScoped<IStatusService, StatusService>();
        services.AddScoped<IGameService, GameService>();
        services.AddScoped<IGameBootstrapper, GameBootstrapper>();

        // Auth
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IPartyCodeValidator, PartyCodeValidator>();
        services.AddScoped<IUsernameClaimService, UsernameClaimService>();
        services.AddScoped<ISessionIssuer, SessionIssuer>();
        services.AddScoped<IRefreshTokenRedeemer, RefreshTokenRedeemer>();
        services.AddScoped<IAccessTokenIssuer, AccessTokenIssuer>();
        services.AddSingleton<IRefreshTokenFactory, RefreshTokenFactory>();

        // Posts
        services.AddSingleton<ICountryCatalogue, CountryCatalogue>();
        services.AddScoped<IActiveRoundReader, ActiveRoundReader>();
        services.AddScoped<IPostCreationService, PostCreationService>();
        services.AddScoped<IPostFeedService, PostFeedService>();
        services.AddScoped<IPostDeletionService, PostDeletionService>();
        services.AddScoped<ICountryTallyService, CountryTallyService>();

        // Admin
        services.AddScoped<IPubStopService, PubStopService>();
        services.AddScoped<IRoundService, RoundService>();
        services.AddScoped<IGameSettingsService, GameSettingsService>();
        services.AddScoped<IUserModerationService, UserModerationService>();
    }
}
