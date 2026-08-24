using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace AroundTheWorld.Tests;

/// <summary>
/// Boots the real WebApi in-process so the HTTP routes are exercised end-to-end — routing,
/// model binding, status codes, serialization — without any external dependency. Running
/// outside the Development environment means no appsettings.Development.json connection string
/// is picked up, so the app skips its database registration and starts cleanly DB-free.
/// Extend this factory (e.g. an in-memory provider) once the scaffold gains real data routes.
/// </summary>
public sealed class StatusApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
    }
}
