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

- Bucket name **`atw-bucket-20260826-2209`** — the bucket you actually created,
  now in the chart (`helm/values.yaml`, `PhotoStorage__Bucket`). If you ever
  rebuild the bucket under a different name, change the chart too: a wrong name
  fails *every* upload forever while reading like bad luck ("Couldn't save that
  photo — try again"), because a missing bucket and a forbidden one are the same
  S3 error.
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
| `Jwt__Secret` | `JwtRegistration.cs:15` | **silent until it isn't** — a random key is generated per process, so everyone is logged out the moment the pod restarts |
| `Admin__Key` | `AdminAccessEndpointFilter.cs:36` | fails *closed*: the break-glass `X-Admin-Key` header stops working (403). Your own admin tab is unaffected — that runs off your token |
| `PhotoStorage__AccessKeyId` | `PhotoStorageOptions.cs:14` | **silent** fallback to pod-local disk |
| `PhotoStorage__SecretAccessKey` | `PhotoStorageOptions.cs:16` | **silent** fallback to pod-local disk |

**Keep `Jwt__Secret` stable.** Regenerating it logs every guest out mid-party.

## 4. Merge, in order

**As of 27 Aug this is done** — everything below is merged into `dev` (#28, #29,
#33, #35, #38) and promoted to `main` up to #36. Kept because the rule outlives
the list:

**Only a merge into `main` deploys anything.** A `dev` merge ships nothing: the
only push trigger on `docker-build-push.yml` is `main`, and that build is what
pins the new image tags back into `helm/values.yaml`. So for any further change,
the sequence is always: merge into `dev` → open a `dev`→`main` PR → merge that.

Wait for the `main` build to go green before step 5, or Argo syncs a chart
pointing at an image tag that does not exist yet.

> **If that build fails, you do not need another merge to retry it.** The
> workflow also has `workflow_dispatch` — Actions → *Build and Push Docker
> Images to OCIR* → **Run workflow** on `main`.

## 5. Approve `oke-fleet#6`

It adds `config/around-the-world.json`, which is what makes the ApplicationSet
generate an Argo `Application` for this app at all. **It needs an approving
review, not just a merge** — and it is my PR, so I cannot approve it.

## 6. Verify — about two minutes

```bash
kubectl -n balenthiran get pods -l app=backend,release=around-the-world
kubectl -n balenthiran logs -l app=backend,release=around-the-world --tail=100 | grep WARNING
```

**Check the first command actually lists a pod before you trust the second.** Both
halves of that selector are load-bearing, and getting either wrong fails in the
direction of good news:

- The pod label is `app: backend`, not `app: around-the-world-backend`
  (`helm/templates/deployment.yaml:17` takes it from `.name` in
  `helm/values.yaml:19`; `around-the-world-backend` is only the Deployment and
  Service *resource* name). A selector that matches nothing makes `grep` print
  nothing — which is exactly what "everything is fine" looks like.
- `release=around-the-world` is what stops it matching the *other* apps. Five
  apps share the `balenthiran` namespace and **four of them also have a pod
  labelled `app: backend`** — balenthiran.co.uk, holiday-planning, macro-metrics
  and this one. Without the release, you would be reading their logs too.

**The grep is the important one, and it should print nothing.** All three silent
failure modes announce themselves there and nowhere else:

- `[WARNING] No database connection string configured` — `ServiceRegistration.cs:27`
- `[WARNING] No OCI Object Storage credentials configured` — `PhotoStorageRegistration.cs:27`
- `[WARNING] No Jwt:Secret configured` — `JwtRegistration.cs:24`. The nastiest of
  the three, because the app looks perfect: guests join, post, everything works —
  and then the pod restarts (a node event, an Argo self-heal, your own
  `kubectl delete pod` in step 4 below) and **every guest at the party is logged
  out at once**, mid-evening, with no way back but re-joining.

Then, from a phone on mobile data (not the office wifi):

1. `balenthiran.co.uk/birthday` loads the join screen.
2. Join as any name → lands on the feed.
3. Join as **`james`** → asks for the code. Enter **`260802`** → you get the
   admin tab. (Admin is granted by *username*, so the code exists purely to stop
   a guest claiming your name.)
4. **Post a photo, then `kubectl delete pod` the backend and reload.** This one
   step tests both silent failures at once:
   - **The photo is still there** → object storage is genuinely wired up. If it
     vanished, you were on the disk fallback.
   - **You are still logged in** → `Jwt__Secret` is stable. If you land back on
     the join screen, the secret is blank and every guest would be kicked the
     same way on the next restart.

## 6a. Claim your name first — before you tell anyone the URL

**Do this the moment the app is up, ahead of step 6.4.** It takes ten seconds
and it closes a real hole.

Admin is granted by **username**, not by a key: `AdminIdentity.IsAdmin()` returns
true for anyone joined as `james` and asks for no `X-Admin-Key`
(`AdminIdentity.cs:20`). The only thing standing between a stranger and that name
is the host code — **and the host code is `260802`, committed in this public
repo** (`GameOptions.cs:14`, and in the README). So until you claim `james`,
anyone who reads the repo can take it and get the admin panel.

Once you have claimed it the hole is shut: a second attempt on the name gets a
409 and no session (`Join_with_a_taken_name_conflicts`). Claiming it first is a
complete fix, which is why nothing in the code was changed for this.

> Changing the code later does **not** help: `GameBootstrapper` seeds
> `GameSettings.PartyCode` from config only on first boot and returns early ever
> after (`GameBootstrapper.cs:17`). If you want a code that isn't public, set
> `Game__PartyCode` **before the first pod starts** — after that it lives in the
> database, not in config.

## 7. What will not tell you it is broken

Two config mistakes leave a **completely healthy-looking app**:

- **Blank photo credentials** → photos are written to `photo-store/` inside the
  container. Everything works all night, and the photos die with the pod. This
  is why step 6.4 restarts the pod rather than just checking a photo loads.
- **Bucket exists but the key pair is wrong** → the S3 client is constructed
  fine and fails on first upload, so you find out when the first guest posts.

Both are worth five minutes on the 27th rather than five minutes at 17:05 on
the 28th.

### If a guest says "it won't post", read the message they got

The compose screen shows the API's own sentence when there is one, so the wording
identifies the layer that failed. This mattered on 27 Aug: uploads were dying at
the ingress, which caps the request body, and the screen could only say the
generic line — so it looked like the bucket.

| What they see | What is actually wrong |
|---|---|
| "Couldn't save that photo — try again. **[storage: X/N]**" | **Object storage**, and the bracket names which part — read it down the phone. `AccessDenied` → the IAM policy. `NoSuchBucket` → the bucket name, namespace or region. `InvalidAccessKeyId` / `SignatureDoesNotMatch` → the key pair. Anything else → my code, and I want to know. (This is the suffix that solved 27 Aug in one retry: it was `NotImplemented/501`, a checksum header OCI does not support.) |
| "That photo is too big — keep it under 8MB." | Genuinely a huge photo. The app said this, so everything upstream is fine. |
| "That photo is too big to send — try a smaller one." | The **ingress** rejected it (413) before the app ran. `nginx.ingress.kubernetes.io/proxy-body-size` in `helm/values.yaml` is `10m` and must stay above the app's 8MB limit. |
| "You've been signed out — join again." | Their token expired, or `Jwt__Secret` changed (a pod restart with no secret set regenerates it). |
| "No connection — check your signal…" | Pub wifi. Not you. |
| "That didn't send — try again. (error N)" | Nothing in the app produced this — the request never reached it. `N` is the status; anything 5xx here is the ingress or the pod being down. |

## 8. Timings and switches, if you need them on the night

These are the code defaults (`GameOptions.cs`) and none is set in
`helm/values.yaml` — but **only one of the four is still an env var once the app
has booted once.** The first three are seeded into the database on first boot and
read from there ever after (`GameBootstrapper.cs:17`, and the same early-return
described in 6a), so setting the env var and restarting does **nothing at all**.
Reach for the right lever:

| Setting | Default | How you change it on the night |
|---|---|---|
| `Game__GoLiveAt` | `2026-08-28T16:00:00Z` — 17:00 BST | **Admin page → "Go live" box.** The env var is inert; the database owns it |
| `Game__ReadOnlyAt` | `2026-08-29T04:00:00Z` — 05:00 BST, feed freezes but stays readable | **Admin page → "Read only" box.** The env var is inert |
| `Game__PartyCode` | `260802` — only claims the host's name | **You can't.** No admin control, and the env var is inert (`PartyCodeValidator.cs:14` reads the database). Set it before the first pod starts or live with `260802` — see 6a |
| `Game__YouTubeUrl` | `https://www.youtube.com/@jemmy8oy` | **Env var + restart.** This one genuinely is read per request (`GameService.cs:39`); blank switches the plug off entirely |

## 8a. Clear your practice posts before 17:00

Step 6.4 has you post a test photo and step 7 asks you to do it on the 27th —
those posts are in the feed your guests will see. Clearing them is one button,
**Admin → "New round"**, but it is rendered **only while the game is in
Practice** (`Admin.tsx:119`) — deliberately, so it can't be fat-fingered in a
dark pub. At 17:00 it disappears.

So clear the round before go-live. If you find test photos in the live feed
afterwards, the way back is on the same page: push **"Go live"** forward a few
minutes, which returns the game to Practice and brings the button back. Deleting
the posts one at a time from the feed also works.

## 8b. Moving the group to the next pub

The one control you will actually use all night: **Admin → 🍺 Next pub**. Unlike
"New round" it is always on the page, in Practice and in Live. The current stop
is in the line above it — `Live · <round name> · Stop 3` — and every photo posted
from that moment lands under that stop in the feed.

**Nothing else moves it.** It is a column on the active round row in the
database, so it survives a pod restart, a redeploy, and the Practice → Live flip
at 17:00 (the mode is worked out from the clock, never stored). The one thing
that *does* reset it is **"New round"**, which starts stop 1 again — which is why
§8a comes first: **clear the round, then start advancing.** Do it the other way
round and you lose the stop you were on.

### It will ask you a question if you tap twice

There is **no undo**. Nothing moves the stop backwards, and the only way to
correct a mis-tap is a new round, which archives everybody's photos. So a second
tap within **five minutes** is refused and turned into a question, in the server's
own words:

> You moved to stop 3 four minutes ago. Move on to stop 4 anyway?

- **OK** → it moves. The guard costs you a tap, never the evening.
- **Cancel** → the screen says *"Next pub — left where it was"* and nothing changed.

It **asks rather than blocks** on purpose: being stranded at the wrong stop
mid-crawl with no way through would be worse than the double-tap it prevents. A
genuine double-tap still cannot get past it — the second tap opens the dialog,
and the dialog swallows the taps after it.

Anything else the button says is a real failure and worth reading. *"There is no
round in progress."* means there is no active round to move — you need **"New
round"**, and once you are Live that button is hidden (`Admin.tsx:119`), so the
route back is the one in §8a: push **"Go live"** forward a few minutes, which
returns the game to Practice and brings the button back.

---

> **Do not run `helm upgrade` by hand.** Once `oke-fleet#6` is in, ArgoCD owns
> this release; a manual install creates a second, unmanaged one that Argo will
> then fight. The README's old deploy section predates the fleet wiring.
