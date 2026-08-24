# Backend Architecture

This document explains the structure and rationale behind the 7-project .NET backend pattern used across all projects scaffolded from this template.

## Project Structure

```
AroundTheWorld/
├── AroundTheWorld.WebApi         # Entry point: routes, DI, OpenAPI, middleware
│   ├── Routes/                 # Minimal API route groups (one file per domain area)
│   ├── Mapper.cs               # DataModel ↔ DomainModel mappings
│   └── ServiceRegistration.cs  # All DI registrations in one place
├── AroundTheWorld.Services       # Business logic implementations
│   └── Mapper.cs               # EntityModel ↔ DomainModel mappings
├── AroundTheWorld.Abstractions   # Interfaces only — no implementations
│   ├── DataModels/             # IStatus, ISubscriber, etc.
│   ├── DomainModels/           # IDomainStatus, IDomainSubscriber, etc.
│   ├── Enums/                  # Shared enums the interfaces reference (the one non-interface exception)
│   └── Services/               # IStatusService, IInterestService, etc.
├── AroundTheWorld.Database       # EF Core DbContext + migrations
├── AroundTheWorld.EntityModels   # Database entity classes (anemic POCOs)
├── AroundTheWorld.DomainModels   # Rich business-layer objects
└── AroundTheWorld.DataModels     # Request/Response DTOs (public API contract)
```

## Dependency Direction

```
WebApi → Services → Database
WebApi → Abstractions ← Services
WebApi → DataModels
Services → EntityModels
Services → DomainModels
```

`WebApi` never imports `Services` directly — only interfaces from `Abstractions`. This keeps the API layer decoupled from business logic implementations.

## Core Principles

### 1. Single Responsibility per Layer

Each project does exactly one thing:
- `EntityModels`: what the database looks like
- `DomainModels`: what the business logic works with
- `DataModels`: what the API exposes to clients
- `Services`: how to transform between them and apply logic
- `Database`: how to persist and query
- `WebApi`: how to route, authenticate, and document

### 2. Layered Mapping Isolation

Two separate AutoMapper profiles keep mappings small and focused:
- `WebApi/Mapper.cs` — maps `DataModel ↔ DomainModel` (API boundary)
- `Services/Mapper.cs` — maps `EntityModel ↔ DomainModel` (DB boundary)

AutoMapper is configured in `ServiceRegistration.cs` to scan all assemblies for `Profile` subclasses automatically.

### 3. Interface-Driven Development

`WebApi` only talks to service interfaces (`IStatusService`, etc.) defined in `Abstractions`. This means:
- The API layer never knows about EF Core, Npgsql, or concrete implementations
- Services can be swapped or mocked without touching routes
- The compile-time contract is clear

### 4. Model Sovereignty: Four Model Types

| Model | Naming | Location | Purpose |
|---|---|---|---|
| Request | `*Request` | `DataModels/` | What the client sends (minimal fields, no server-managed properties) |
| Data Model | Simple noun | `DataModels/` | What the API returns to clients |
| Domain Model | `Domain*` | `DomainModels/` | Internal rich model used by service layer; extends its DataModels counterpart |
| Entity | `*Entity` | `EntityModels/` | Direct EF Core database mapping |

**Never include server-managed fields** (`Id`, `CreatedAt`, `IsVerified`) in `*Request` models. This prevents over-posting attacks.

**Naming rules for `*Request` / `*Response`:**
- Use `*Request` only for inbound route arguments that have non-trivial shape (e.g. a POST body with validation). Simple query-string parameters do not need a request wrapper.
- Use `*Response` only when the route constructs a return shape that is **meaningfully different** from what the service returns — i.e. it aggregates, renames, or adds fields. If the route simply maps a domain model 1-to-1 to a data model, the data model should use a plain noun (`Ratio`, not `RatioResponse`).
- `Domain*` models extend their `DataModels/` counterpart (e.g. `DomainRatio : Ratio`) and add business-layer behaviour. They are never returned directly by routes.

### 5. Route Grouping (Minimal APIs)

Routes are organized into `Routes/` and registered via extension methods. Handlers
are **named static methods** (not inline lambdas) with **concrete `TypedResults`
return types** — never a bare `Results.Ok(...)`/`IResult`. Only a concrete return type
(`Ok<T>`, `Results<Ok<T>, NotFound>`, `Created<T>`, `NoContent`) lets OpenAPI describe
the response body, which is what the frontend codegen turns into typed hooks. Service
view interfaces are mapped to their concrete response records via `IMapper`.

```csharp
// Program.cs
app.MapGroup("/api")
    .MapStatusRoutes()
    .MapInterestRoutes()
    .WithOpenApi();

// Routes/InterestRoutes.cs
public static class InterestRoutes
{
    public static RouteGroupBuilder MapInterestRoutes(this RouteGroupBuilder group)
    {
        group.MapGet("/interest/{id:int}", GetInterest).WithName("GetInterest");
        return group;
    }

    // Named delegate + concrete return type → OpenAPI knows the 200 body is `Interest`
    // and the 404 has no body. Inline `async (id, svc) => Results.Ok(...)` would erase both.
    private static async Task<Results<Ok<Interest>, NotFound>> GetInterest(
        int id, IInterestService svc, IMapper mapper) =>
        await svc.GetAsync(id) is { } interest      // service returns the interface I*
            ? TypedResults.Ok(mapper.Map<Interest>(interest))  // mapped to the concrete record
            : TypedResults.NotFound();
}
```

This keeps `Program.cs` lean regardless of how many endpoints are added.

### 6. OpenAPI as the Source of Truth

The backend generates an OpenAPI schema at `/openapi/v1.json`. The frontend RTK Query client is generated directly from this schema — no manual HTTP calls, no drifting types. See `docs/specs/openapi-codegen.md`.

For the schema to carry response types, every handler must return a **concrete
`TypedResults` type** (see §5). A handler that returns `IResult` (the type of any
`Results.Ok(...)` lambda) contributes an endpoint with *no* response schema, so the
generated hook types come out as `unknown`. Typed handlers are what make the schema — and therefore the frontend types — trustworthy.

### 7. Auto-Run Migrations

`Program.cs` runs pending EF migrations on startup:

```csharp
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    dbContext.Database.Migrate();
}
```

This means a fresh deployment always reaches the correct schema without manual intervention. Acceptable for solo/small-team projects; revisit for high-availability deployments.

### 8. One Type Per File

Every `.cs` file declares exactly one top-level type — one class, interface, record or enum — and the file is named after it. This keeps the folder tree a faithful map of the type graph: you find `HabitView` in `HabitView.cs`, never buried three records down in a `Views.cs`.

This is enforced at build time. `backend/Directory.Build.props` pulls in `StyleCop.Analyzers`, and `backend/.editorconfig` silences everything it ships except **SA1402** (*a file may only contain a single type*), which is promoted to an **error**. A multi-type file fails `dotnet build`. (Filename-match, SA1649, is intentionally left off — it false-flags the `AppDbContext` file name and EF-generated migrations.) Nested `private` helper types are allowed, since SA1402 only counts top-level types.

Pure logic gets a home for the same reason: no `static` utility classes in `Services` — see `docs/specs/backend-srp.md`.

### 9. Error Handling: Throw, Don't Catch

Routes never `try/catch`. Services **throw** a typed `AppException` when they hit a
recognised failure, and a single global handler turns it into an RFC 7807
`ProblemDetails` response. This removes per-route error plumbing entirely — a route
expresses only its success shape (`Ok<T>`), and a forgotten catch can no longer leak
a raw 500.

**The exception vocabulary** lives in `Abstractions/Exceptions/` (shared domain
vocabulary). Every anticipated failure derives from the abstract `AppException`, which
carries a stable machine-readable `ErrorCode`. It holds **no HTTP status** — the status
is decided only at the WebApi boundary, so no HTTP concept leaks below it.

| Exception | HTTP | `errorCode` | Use when |
|---|---|---|---|
| `NotFoundException` | 404 | `not_found` | The addressed resource does not exist |
| `ValidationException` | 400 | `invalid_input` | Well-formed but a business rule rejected it |
| `ConflictException` | 409 | `conflict` | Clashes with current state (duplicate, lost update) |
| `UnauthorizedException` | 401 | `unauthenticated` | No / invalid credentials |
| `ForbiddenException` | 403 | `forbidden` | Authenticated but not permitted |
| `UpstreamServiceException` | 502 | `upstream_failure` | A downstream dependency failed |
| *anything else* | 500 | `internal_error` | Unexpected fault — message **not** exposed, logged with stack |

**The handler** is `WebApi/ExceptionHandling/AppExceptionHandler.cs` (implements
`IExceptionHandler`), registered in `Program.cs`:

```csharp
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<AppExceptionHandler>();
// ...
app.UseExceptionHandler();   // first in the pipeline
```

The pure type→status mapping lives in `ExceptionHandling/ExceptionResult.cs` so it is
unit-testable without the HTTP pipeline. `AppException` messages are surfaced in the
response `detail`; unexpected faults get a generic message (no internal detail leaked)
but are logged at `Error` with the full exception.

**Rules of thumb**
- A service method that addresses a resource by id **throws `NotFoundException`** when
  it is missing — it does not return `null`. Callers get the value or an exception.
- Routes that can raise a known failure add `.ProducesProblem(StatusCodes.Status404NotFound)`
  (or the relevant code) so the OpenAPI document — and the generated client — stay honest.
- Reach for `ValidationException`/`ConflictException`/`UpstreamServiceException` in the
  service the moment you detect the condition; never translate to HTTP by hand.
- **Add a new exception type when none fits.** The six above are a starting vocabulary,
  not a closed set. If a failure has no clean home among them, add a **new**
  `AppException` subclass — its own file in `Abstractions/Exceptions/`, a distinct
  `ErrorCode`, and a mapping arm in `ExceptionResult.Resolve` — rather than forcing it
  into an ill-fitting existing type. A precise `errorCode` is worth more to the client
  than a reused-but-wrong one.

## Adding a New Feature (Checklist)

1. Add `*Entity` to `EntityModels/`, add `DbSet<>` to `DbContext`, create migration
2. Add `Domain*` to `DomainModels/`
3. Add `I*` interface to `Abstractions/DataModels/` and `Abstractions/DomainModels/`
4. Add `*` data model and `*Request` to `DataModels/`
5. Add `I*Service` interface to `Abstractions/Services/`
6. Implement `*Service` in `Services/`, add `EntityModel ↔ DomainModel` mappings in `Services/Mapper.cs`. **Throw** a typed `AppException` (§9) on any recognised failure — e.g. `NotFoundException` for a missing resource — rather than returning `null` or catching
7. Register service in `ServiceRegistration.cs`
8. Add `DataModel ↔ DomainModel` mappings in `WebApi/Mapper.cs`
9. Add route group in `Routes/*Routes.cs`, register in `Program.cs`. Add `.ProducesProblem(<code>)` for each failure the route can raise (§9) so the OpenAPI stays honest
10. Rebuild the backend in Debug to refresh `openapi.json`, then run `npm run codegen` in `frontend/` to regenerate typed hooks
