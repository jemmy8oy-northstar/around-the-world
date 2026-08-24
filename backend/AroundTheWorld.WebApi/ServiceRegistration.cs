using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Abstractions.Services.Auth;
using AroundTheWorld.Services;
using AroundTheWorld.Services.Auth;
using AroundTheWorld.WebApi.Authentication;
using AroundTheWorld.WebApi.Photos;
using AroundTheWorld.Services.Configuration;
using AroundTheWorld.Database;
using Microsoft.EntityFrameworkCore;

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

        services.AddPhotoStorage(configuration);

        services.AddJwtAuthentication(configuration);

        services.AddAutoMapper(cfg => cfg.AddMaps(AppDomain.CurrentDomain.GetAssemblies()));

        services.AddSingleton<IClock, SystemClock>();
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
    }
}
