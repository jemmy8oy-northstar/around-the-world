# Around the World 🌍🍻

A mobile-only photo game for a birthday pub crawl. You drink something from a
different country at every stop, photograph it, caption it, and tag where the
drink is from. The group gets a shared chronological feed and a world map that
fills up as the night goes on.

**Live at:** `balenthiran.co.uk/birthday`

> The country tag is **where the drink is from, not where the drinker is**. That
> is the whole conceit of an around-the-world crawl, and it means there is no
> geolocation anywhere in this app — no permission prompt, no GPS handling, no
> privacy surface. Country comes from a picker.

Full design record: [`docs/spec.md`](docs/spec.md).
How the build went, and what to fix in `web-template`: [`docs/build-log.md`](docs/build-log.md).

---

## How it plays

| | |
|---|---|
| **Getting in** | Pick a username. No code, no email, no password. (The host's name is the exception — it still needs the code, because admin is granted by username.) |
| **Posting** | Camera → caption → country. Photos are resized in the browser before upload. |
| **Feed** | Newest first, grouped under pub-stop dividers. |
| **Map** | One numbered badge per country; tap it for that country's drinks. |
| **Board** | Countries ranked by how many drinks came from them. |
| **Admin** | Hidden page: next pub, new round, shadow ban, release a name, move the cutovers. |

### The three modes

Mode is derived from two timestamps on **every request** — there is no scheduled
job and no redeploy involved, and both timestamps are editable from the admin
page.

```
now < GoLiveAt                 →  Practice   postable, banner says "practice"
GoLiveAt <= now < ReadOnlyAt   →  Live       the real thing
now >= ReadOnlyAt              →  Finished   read-only keepsake
```

---

## Running locally

You need [.NET 10](https://dotnet.microsoft.com/download),
[Node 20+](https://nodejs.org/) and PostgreSQL.

**No OCI credentials are needed.** Without them the app writes photos to a local
`photo-store/` directory and serves them back, so everything works end to end.

### 1. Configure

Create `backend/AroundTheWorld.WebApi/appsettings.Development.json` (gitignored):

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=around_the_world;Username=postgres;Password=postgres"
  },
  "Jwt": { "Secret": "<64 hex chars — openssl rand -hex 32>" },
  "Admin": { "Key": "dev-admin-key" }
}
```

Then create the database and apply migrations:

```bash
createdb around_the_world
cd backend && dotnet ef database update \
  --project AroundTheWorld.Database \
  --startup-project AroundTheWorld.WebApi
```

The first run seeds the settings row and Round 1 automatically — host code
`260802` (needed only to claim the host's name), go-live 28 Aug 2026 17:00 BST,
read-only 29 Aug 05:00 BST.

### 2. Run

```bash
# Terminal 1 — API on http://localhost:5257, docs at /scalar/v1
cd backend
ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5257 \
  dotnet run --project AroundTheWorld.WebApi --no-launch-profile

# Terminal 2 — app on http://localhost:5173/birthday/
cd frontend && npm install && npm run dev
```

> The app is served from the `/birthday` subpath both locally and in production,
> so the API is called at `/birthday/api/...`. The Vite dev proxy strips the
> prefix; in the cluster the backend adds it back via `PathBase`. Getting these
> out of step is the classic "works on localhost, 404s in the cluster" failure.

### 3. Tests

```bash
cd backend  && dotnet test        # 142 unit + in-process integration
cd frontend && npm test           # 52 Vitest
cd frontend && npx playwright test # 16 e2e on WebKit, phone viewport
```

The e2e suite runs against mocked API responses, needs no backend, and writes
screenshots to `frontend/e2e/screenshots/` for visual review.

### Regenerating things

```bash
cd backend  && dotnet build AroundTheWorld.WebApi -c Debug  # refreshes openapi.json
cd frontend && npm run codegen                              # OpenAPI → RTK Query hooks
cd frontend && npm run generate:countries                   # rebuilds src/data/countries.json
```

---

## Deployment

Images are built by `.github/workflows/docker-build-push.yml`, which runs on
every **push to `main`** as well as on `workflow_dispatch` — so promoting `dev`
into `main` builds and pushes both images and pins their versions back into
`helm/values.yaml`. The chart in `helm/` deploys both apps behind the shared
`balenthiran.co.uk` ingress.

> The comment block at the top of that workflow still claims it is "triggered
> manually only". That is stale — read the `on:` block, not the prose above it.

### 1. Create the secret

Everything secret comes from one Kubernetes Secret in the target namespace:

```bash
kubectl create secret generic around-the-world-secrets \
  --from-literal=ConnectionStrings__DefaultConnection='Host=...;Database=...;Username=...;Password=...' \
  --from-literal=Jwt__Secret="$(openssl rand -hex 32)" \
  --from-literal=Admin__Key="$(openssl rand -hex 16)" \
  --from-literal=PhotoStorage__AccessKeyId='...' \
  --from-literal=PhotoStorage__SecretAccessKey='...'
```

| Key | What it is |
|---|---|
| `ConnectionStrings__DefaultConnection` | Postgres connection string |
| `Jwt__Secret` | Session token signing key. **Must be stable** — regenerating it logs everyone out |
| `Admin__Key` | The `X-Admin-Key` value for the hidden admin page |
| `PhotoStorage__AccessKeyId` / `SecretAccessKey` | OCI S3 Compatibility API key pair |

Non-secret storage settings (`Bucket`, `Region`, `ServiceUrl`, `PublicBaseUrl`)
are plain values in `helm/values.yaml`.

### 2. Set up the photo bucket

1. Create a bucket in **OCI Object Storage**.
2. Set visibility to **Object-Read-Only** if you want photos served straight
   from the bucket. Leave it private and set `PhotoStorage__PublicBaseUrl` to
   `""` to have the API proxy them instead — both work.
3. In the OCI console, under your user's **Customer Secret Keys**, generate an
   **S3 Compatibility API key**. That gives the access key / secret pair.
4. `PhotoStorage__ServiceUrl` in `helm/values.yaml` is already set to
   `https://lr7uc6l49odc.compat.objectstorage.uk-london-1.oraclecloud.com` —
   the same tenancy namespace `registryPrefix` pushes images to. Change it only
   if the bucket lives in a different tenancy.

> `ForcePathStyle` is enabled in the S3 client because OCI's compatibility layer
> does not support virtual-host style bucket addressing.

### 3. Deploy

```bash
helm upgrade --install around-the-world ./helm --namespace <ns>
```

If OCI settings are left blank the backend falls back to on-disk photo storage
and logs a warning. That is fine for a smoke test but **not** for real use: the
directory is local to the pod, so it does not survive a restart and does not
work across replicas.

---

## Repository layout

```
backend/     .NET 10, 7-project Clean Architecture — see docs/specs/backend-architecture.md
frontend/    React 19 + Vite, mobile-only, org design system (casual theme)
helm/        Chart for both apps behind the shared ingress
docs/spec.md          The design record
docs/build-log.md     What worked, what didn't, what to fix upstream
docs/screenshots/     Mobile screenshots of every screen
```

Conventions for working in here: [`CLAUDE.md`](CLAUDE.md) and
[`.agents/rules/project.md`](.agents/rules/project.md).
