using System.Security.Cryptography;
using System.Text;
using AroundTheWorld.Services.Configuration;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace AroundTheWorld.WebApi.Authentication;

public static class JwtRegistration
{
    public static void AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var options = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();

        if (string.IsNullOrWhiteSpace(options.Secret))
        {
            // Falling back to a random per-process key rather than throwing keeps the
            // build-time OpenAPI generator (which boots the host outside Development,
            // so appsettings.Development.json never loads) working. It is deliberately
            // ephemeral: a misconfigured deployment logs everyone out on every restart,
            // which is loud, instead of quietly signing with a known placeholder.
            options.Secret = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            Console.WriteLine(
                "[WARNING] No Jwt:Secret configured — using an ephemeral signing key. " +
                "Sessions will not survive a restart and will not work across replicas.");
        }

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(bearer =>
            {
                bearer.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = options.Issuer,
                    ValidateAudience = true,
                    ValidAudience = options.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Secret)),
                    ValidateLifetime = true,
                };
            });

        // Setting JwtBearerOptions.TimeProvider is not enough: the token handler's
        // lifetime check reads DateTime.UtcNow directly unless an explicit
        // LifetimeValidator is supplied. Without this a token issued on the app's
        // clock can be rejected as "not yet valid" by a handler reading a different
        // one — which is exactly what happened in the integration tests.
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<TimeProvider>((bearer, timeProvider) =>
            {
                bearer.TimeProvider = timeProvider;
                bearer.TokenValidationParameters.LifetimeValidator =
                    (notBefore, expires, _, _) =>
                    {
                        var now = timeProvider.GetUtcNow().UtcDateTime;
                        var skew = TimeSpan.FromMinutes(1);

                        return (notBefore is null || notBefore <= now + skew)
                            && (expires is null || expires > now - skew);
                    };
            });

        services.AddAuthorization();
    }
}
