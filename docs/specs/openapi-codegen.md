# OpenAPI → Frontend Codegen

The frontend API client (`src/api/generatedApi.ts`) is generated automatically from the backend's OpenAPI schema. This ensures the frontend types always match the compiled backend — no manual HTTP calls, no drifting field names.

## How It Works

The backend emits its OpenAPI document **at build time** — no running server required —
via `Microsoft.Extensions.ApiDescription.Server`. A Debug build runs the app in-process
(it skips DB startup while doing so, see below) and writes the schema to a committed
`backend/AroundTheWorld.WebApi/openapi.json`. The frontend codegen reads that file, so
`npm run codegen` works offline and in CI.

```
.NET Backend  (dotnet build -c Debug)
  └── Microsoft.Extensions.ApiDescription.Server  (GetDocument.Insider, in-process)
        └── backend/AroundTheWorld.WebApi/openapi.json  (committed schema)
              └── @rtk-query/codegen-openapi
                    └── src/api/generatedApi.ts  (typed RTK Query hooks)
```

The codegen config is in `frontend/openapi-config.cjs`:

```js
const config = {
  schemaFile: '../backend/AroundTheWorld.WebApi/openapi.json',
  apiFile: './src/api/emptyApi.ts',
  apiImport: 'emptySplitApi',
  outputFile: './src/api/generatedApi.ts',
  hooks: true,
};
```

The live `http://localhost:5257/openapi/v1.json` endpoint still exists (Scalar UI at
`/scalar/v1`) for exploring the API; codegen just no longer depends on it being up.

### Why the build doesn't touch a database

Build-time generation loads the whole app to enumerate its endpoints, which runs the
top-level code in `Program.cs`, including the startup migration. That block is guarded so
it is **skipped when the entry assembly is `GetDocument.Insider`** — otherwise a Debug
build with a configured connection string would try to migrate a database. Serving the app
normally runs the migration as usual.

## Typed Responses (required)

The codegen is only as good as the schema, and the schema is only as good as the
handler return types. **Every route handler must be a named static method that returns
a concrete `TypedResults` type** — never an inline lambda returning `Results.Ok(...)`.

```csharp
// ✅ OpenAPI knows the 200 body is Interest and the 404 has no body
private static async Task<Results<Ok<Interest>, NotFound>> GetInterest(
    int id, IInterestService svc, IMapper mapper) =>
    await svc.GetAsync(id) is { } interest
        ? TypedResults.Ok(mapper.Map<Interest>(interest))
        : TypedResults.NotFound();

// ❌ Return type is IResult — OpenAPI records no response schema, hook type is `unknown`
group.MapGet("/{id:int}", async (int id, IInterestService svc) =>
    await svc.GetAsync(id) is { } i ? Results.Ok(i) : Results.NotFound());
```

Why it matters:
- `TypedResults.Ok(value)` returns `Ok<T>`; the union `Results<Ok<T>, NotFound>` also
  advertises the non-success shapes. OpenAPI reads these off the signature.
- The response type `T` must be a **concrete record** (`Interest`), not a service view
  **interface** (`IInterest`). Services return interfaces; the handler maps to the
  concrete record via `IMapper` (`WebApi/Mapper.cs`) so the wire contract — and the
  generated TypeScript type — is a real, named shape.
- A shape the service does not return directly gets a concrete `*Response` record the
  route assembles.

## Running the Codegen

1. **Refresh the schema** with a Debug backend build (regenerates the committed
   `openapi.json` — no running server needed):
   ```bash
   cd backend
   dotnet build AroundTheWorld.WebApi -c Debug
   ```
   You only need this step when you have changed the API. If `openapi.json` is already
   up to date, skip straight to codegen.

2. **Run codegen** from the `frontend/` directory:
   ```bash
   npm run codegen
   ```

3. **Use the generated hooks** in your components:
   ```tsx
   import { useGetStatusQuery } from '../api/generatedApi';

   const { data, isLoading, isError } = useGetStatusQuery();
   ```

## The Base API (`emptyApi.ts`)

`generatedApi.ts` injects its endpoints into `emptySplitApi`, which is defined in `src/api/emptyApi.ts`:

```ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const emptySplitApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/' }),
  endpoints: () => ({}),
});
```

This is the base — the codegen injects all endpoints into it via `injectEndpoints`. If you need to add custom endpoints not covered by the OpenAPI schema (e.g. queries against static JSON files), inject them separately:

```ts
// src/api/customApi.ts
import { emptySplitApi as api } from './emptyApi';

export const customApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSomething: build.query<MyType[], void>({
      query: () => ({ url: '/api/something' }),
    }),
  }),
});

export const { useGetSomethingQuery } = customApi;
```

## Important Rules

- **Never hand-edit `generatedApi.ts`** — it is always overwritten by `npm run codegen`
- Run codegen any time you add, rename, or remove a backend endpoint
- The Vite dev server proxies `/api` and `/openapi` to `http://localhost:5257` — see `vite.config.ts`
- In production, the frontend is served by Nginx which proxies `/api` to the backend service (configured in `nginx.conf`)

## Adding a New Endpoint (End-to-End)

1. Add route in `backend/AroundTheWorld.WebApi/Routes/*.cs`
2. Ensure the route is registered in `Program.cs` within the `.WithOpenApi()` chain
3. Rebuild the backend in Debug (`dotnet build AroundTheWorld.WebApi -c Debug`) to refresh `openapi.json`
4. Run `npm run codegen` in `frontend/`
5. Import and use the new hook (`use*Query` or `use*Mutation`) in your component

## Troubleshooting

| Issue | Fix |
|---|---|
| Hooks are missing a new endpoint | `openapi.json` is stale — rebuild the backend in Debug, then re-run codegen |
| `ENOENT` reading `openapi.json` | Do a Debug backend build once to generate it |
| Hook types show as `unknown` | The endpoint has no typed response — add a typed return model in the backend |
| Codegen overwrites custom code | Never put custom code in `generatedApi.ts` — use a separate `customApi.ts` |
