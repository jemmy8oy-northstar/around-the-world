using System.Text.Json.Serialization;
using Scalar.AspNetCore;
using AroundTheWorld.WebApi;
using AroundTheWorld.WebApi.ExceptionHandling;
using AroundTheWorld.WebApi.Routes;
using AroundTheWorld.Abstractions.Services;
using AroundTheWorld.Database;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddBackendServices(builder.Configuration);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    // Enums on the wire as names, not ordinals: the generated TypeScript client
    // gets a "Practice" | "Live" | "Finished" union instead of a bare number, so
    // the frontend branches on meaning rather than on a magic 2.
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());

    // .NET 10 describes int32 as ["integer","string"] by default, because it will
    // happily read a number from a JSON string. That union propagates into every
    // integer field of the generated client. We never send numbers as strings.
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

// Global exception handling: AppExceptionHandler maps thrown AppExceptions to RFC 7807
// ProblemDetails; AddProblemDetails supplies the writer + standard fields.
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<AppExceptionHandler>();

var app = builder.Build();

// Must sit at the top of the pipeline so it catches exceptions from everything below it.
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference("/scalar/v1");
}

// When the build-time OpenAPI generator (GetDocument.Insider) loads the app purely to emit the
// OpenAPI document it runs this top-level code but never serves requests — it must not touch a
// database, or a Debug build would try to migrate against whatever connection string is configured.
var generatingOpenApiDocument =
    System.Reflection.Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";

if (!generatingOpenApiDocument)
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetService<AppDbContext>();
    if (dbContext is null)
    {
        app.Logger.LogWarning("Skipping database migration — no connection string configured.");
    }
    else
    {
        // The in-process integration tests swap in the InMemory provider, which
        // cannot Migrate — see docs/specs/testing-strategy.md.
        if (dbContext.Database.IsRelational())
            dbContext.Database.Migrate();
        else
            dbContext.Database.EnsureCreated();

        // A fresh database has no settings row and no round, so nothing is
        // playable until this runs.
        await scope.ServiceProvider.GetRequiredService<IGameBootstrapper>()
            .EnsureInitialisedAsync();
    }
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapGroup("/api")
    .MapStatusRoutes()
    .MapGameRoutes()
    .MapAuthRoutes()
    .MapPhotoRoutes()
    .MapPostRoutes()
    .MapCountryRoutes()
    .MapAdminRoutes()
    .WithOpenApi();

app.Run();

// Exposed so the test project can boot the real host in-process via
// WebApplicationFactory<Program> (top-level statements make Program internal by default).
public partial class Program;
