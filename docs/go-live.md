# Go-live runbook — 28 Aug 2026, 17:00 BST

Every value below was read out of this repo or `oke-fleet`, not remembered.
Where something is genuinely your choice (the database name), it says so rather
than inventing one.

The app has **never been deployed**. That means the steps here have never run
end to end, so do them in order and use the verification in step 6 — most of
what can go wrong on the night goes wrong **silently** (see step 7).

---

## The order matters

The secret must exist **before** ArgoCD first syncs. If Argo syncs first the
pods sit in `CreateContainerConfigError` until you fix it — recoverable, but
it's a worse thing to be debugging at 17:00 than at leisure.

| # | Step | Whose hands |
|---|---|---|
| 1 | Create the database | yours |
| 2 | Create the bucket + S3 key | yours |
| 3 | Create the Kubernetes Secret | yours |
| 4 | Merge the app PRs, in order | yours |
| 5 | Approve `oke-fleet#6` | yours |
| 6 | Verify | yours, ~2 minutes |

Steps 1–3 can happen any time before step 4. Nothing in them depends on the code.

---

## 1. Database

Postgres. The **name is your choice** — nothing in the deployed config pins it,
because the connection string is passed whole as one secret value. Local
development uses `around_the_world` and matching it keeps things unsurprising:

```sql
CREATE DATABASE around_the_world;
```

Whatever you pick must match `Database=` in the connection string in step 3.

Schema is created by EF migrations on startup — you do not need to run anything.

## 2. Bucket + S3 key

- Bucket name **`around-the-world`** (`helm/values.yaml:47` — change the chart if
  you name it something else).
- Region **`uk-london-1`**, service URL already set to
  `https://lr7uc6l49odc.compat.objectstorage.uk-london-1.oraclecloud.com`
  (`helm/values.yaml:56`) — the same tenancy the images push to.
- Leave the bucket **private**. `PhotoStorage__PublicBaseUrl` is `""`
  (`helm/values.yaml:60`), which means the API proxies photos rather than
  linking to the bucket directly. That is the configuration that is tested.
- The key pair comes from **Customer Secret Keys → S3 Compatibility API key**
  on your OCI user.

## 3. The Kubernetes Secret

Namespace is **`balenthiran`** (`oke-fleet` → `config/around-the-world.json`,
`targetNamespace`). Nothing in either repo creates this secret — it is manual,
and it is the single most likely cause of a first-deploy failure.

```bash
kubectl create secret generic around-the-world-secrets -n balenthiran \
  --from-literal=ConnectionStrings__DefaultConnection='Host=<host>;Database=around_the_world;Username=<user>;Password=<pw>' \
  --from-literal=Jwt__Secret="$(openssl rand -hex 32)" \
  --from-literal=Admin__Key="$(openssl rand -hex 16)" \
  --from-literal=PhotoStorage__AccessKeyId='<from step 2>' \
  --from-literal=PhotoStorage__SecretAccessKey='<from step 2>'
```

All five keys are required. Each is read by exactly one thing:

| Key | Read by | If blank |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | `ServiceRegistration.cs:24` | DB features disabled — every request 500s |
| `Jwt__Secret` | `JwtOptions.Secret` | tokens signed with an empty key |
| `Admin__Key` | `AdminOptions.Key` | admin page unlocks with no key |
| `PhotoStorage__AccessKeyId` | `PhotoStorageOptions.cs:14` | **silent** fallback to pod-local disk |
| `PhotoStorage__SecretAccessKey` | `PhotoStorageOptions.cs:16` | **silent** fallback to pod-local disk |

**Keep `Jwt__Secret` stable.** Regenerating it logs every guest out mid-party.

## 4. Merge, in order

1. **`around-the-world#29`** → `dev`. Carries #29 + #30 + #32 (entry code, YouTube
   plug, admin rename) — they were reunited onto this branch after #30/#32 were
   merged top-down.
2. **`around-the-world#31`** → `main`. **This is the click that builds the
   images.** A `dev` merge deploys nothing: `docker-build-push.yml` triggers on
   push to `main` only, and it pins the new tags back into `helm/values.yaml`.

Wait for the `main` build to go green before step 5, or Argo syncs a chart
pointing at an image tag that does not exist yet.

## 5. Approve `oke-fleet#6`

It adds `config/around-the-world.json`, which is what makes the ApplicationSet
generate an Argo `Application` for this app at all. **It needs an approving
review, not just a merge** — and it is my PR, so I cannot approve it.

## 6. Verify — about two minutes

```bash
kubectl -n balenthiran get pods -l app=around-the-world-backend
kubectl -n balenthiran logs -l app=around-the-world-backend --tail=100 | grep WARNING
```

**The grep is the important one, and it should print nothing.** Both silent
failure modes announce themselves there and nowhere else:

- `[WARNING] No database connection string configured` — `ServiceRegistration.cs:27`
- `[WARNING] No OCI Object Storage credentials configured` — `PhotoStorageRegistration.cs:25`

Then, from a phone on mobile data (not the office wifi):

1. `balenthiran.co.uk/birthday` loads the join screen.
2. Join as any name → lands on the feed.
3. Join as **`james`** → asks for the code. Enter **`260802`** → you get the
   admin tab. (Admin is granted by *username*, so the code exists purely to stop
   a guest claiming your name.)
4. **Post a photo, then `kubectl delete pod` the backend and reload.** If the
   photo is still there, object storage is genuinely wired up. If it vanished,
   you were on the disk fallback — the one failure the app will not tell you about.

## 7. What will not tell you it is broken

Two config mistakes leave a **completely healthy-looking app**:

- **Blank photo credentials** → photos are written to `photo-store/` inside the
  container. Everything works all night, and the photos die with the pod. This
  is why step 6.4 restarts the pod rather than just checking a photo loads.
- **Bucket exists but the key pair is wrong** → the S3 client is constructed
  fine and fails on first upload, so you find out when the first guest posts.

Both are worth five minutes on the 27th rather than five minutes at 17:05 on
the 28th.

## 8. Timings and switches, if you need them on the night

All are code defaults (`GameOptions.cs`) — none is set in `helm/values.yaml`, so
each can be overridden with an env var and a restart:

| Setting | Default | Notes |
|---|---|---|
| `Game__GoLiveAt` | `2026-08-28T16:00:00Z` | 17:00 BST |
| `Game__ReadOnlyAt` | `2026-08-29T04:00:00Z` | 05:00 BST — feed freezes, stays readable |
| `Game__PartyCode` | `260802` | only claims the host's name |
| `Game__YouTubeUrl` | `https://www.youtube.com/@jemmy8oy` | **blank switches the plug off entirely** — read per request, so a restart is enough |

---

> **Do not run `helm upgrade` by hand.** Once `oke-fleet#6` is in, ArgoCD owns
> this release; a manual install creates a second, unmanaged one that Argo will
> then fight. The README's old deploy section predates the fleet wiring.
