// Verify the new admin tests are load-bearing: break one rule at a time and
// require the named test to go RED. Restores from git after every mutation, so a
// crash cannot leave a real source file patched.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "/data/repos/around-the-world";

const MUTATIONS = [
  {
    name: "the admin claim is never stamped on the token",
    file: "backend/AroundTheWorld.Services/Auth/AccessTokenIssuer.cs",
    find: "claims.Add(new Claim(AdminClaims.IsAdmin, AdminClaims.TrueValue));",
    replace: "_ = AdminClaims.TrueValue;",
    expect: "The_admin_s_own_token_opens_the_admin_routes_with_no_key",
  },
  {
    name: "everyone is the admin",
    file: "backend/AroundTheWorld.Services/Admin/AdminIdentity.cs",
    find: "return Normalise(username) == Normalise(configured);",
    replace: "return true;",
    expect: "An_ordinary_players_token_does_not_open_the_admin_routes",
  },
  {
    name: "a blank configured admin name matches everyone",
    file: "backend/AroundTheWorld.Services/Admin/AdminIdentity.cs",
    find: "if (string.IsNullOrWhiteSpace(configured) || string.IsNullOrWhiteSpace(username))",
    replace: "if (false)",
    // The UNIT test, not the integration one. The integration test joins as
    // "james" against a blank config, and for that input the ordinary comparison
    // already returns false — so the guard is unreachable and the mutation is
    // equivalent. The case the guard actually exists for is a blank matching a
    // blank, which only the unit test's null/empty rows reach.
    expect: "A_blank_configured_name_makes_nobody_the_admin",
  },
  {
    name: "ban state is added to the public post wire model",
    file: "backend/AroundTheWorld.DataModels/Models/Post.cs",
    find: "public DateTime CreatedAt { get; set; }",
    replace:
      "public DateTime CreatedAt { get; set; }\n\n    public bool AuthorIsShadowBanned { get; set; }",
    expect: "The_post_wire_model_never_carries_ban_state",
  },
  {
    name: "the admin's feed hides shadow-banned posts like everyone else's",
    file: "backend/AroundTheWorld.Services/Posts/PostFeedService.cs",
    find: "if (!viewerIsAdmin)",
    replace: "if (true)",
    expect: "The_admin_sees_shadow_banned_posts_that_everyone_else_cannot",
  },
  {
    name: "the admin can delete any post via the ordinary route regardless of token",
    file: "backend/AroundTheWorld.WebApi/Routes/PostRoutes.cs",
    find:
      "postId,\n            CurrentUser.IdFrom(principal),\n            CurrentUser.IsAdmin(principal),",
    replace: "postId,\n            CurrentUser.IdFrom(principal),\n            true,",
    expect: "An_ordinary_player_still_cannot_delete_someone_else_s_post",
  },
  {
    name: "the shared key is ignored entirely",
    file: "backend/AroundTheWorld.WebApi/Admin/AdminAccessEndpointFilter.cs",
    find: "if (!FixedTimeEquals(supplied, configuredKey))",
    replace: "if (true)",
    expect: "The_shared_key_still_works_for_someone_who_never_joined",
  },
];

function restore(file) {
  execFileSync("git", ["-C", ROOT, "checkout", "--", file]);
}

function runTest(filter) {
  try {
    execFileSync(
      "dotnet",
      ["test", "--nologo", "-v", "q", "--filter", `FullyQualifiedName~${filter}`],
      { cwd: `${ROOT}/backend`, stdio: "pipe", timeout: 900_000 },
    );
    return "PASSED";
  } catch {
    return "FAILED";
  }
}

let survived = 0;

// Control first: with nothing mutated every named test must pass, or a "kill"
// below could just be a test that was already red.
console.log("control (no mutation):");
for (const m of MUTATIONS) {
  const result = runTest(m.expect);
  console.log(`  ${result === "PASSED" ? "ok" : "BROKEN"}  ${m.expect}`);
  if (result !== "PASSED") survived++;
}
if (survived) {
  console.log("\ncontrol failed — aborting, the mutations would be meaningless");
  process.exit(1);
}

console.log("\nmutations:");
for (const m of MUTATIONS) {
  const path = `${ROOT}/${m.file}`;
  const before = readFileSync(path, "utf8");
  const occurrences = before.split(m.find).length - 1;

  if (occurrences !== 1) {
    console.log(`  ⚠️  ANCHOR MATCHED ${occurrences}x — ${m.name}`);
    survived++;
    continue;
  }

  try {
    writeFileSync(path, before.replace(m.find, m.replace));
    const result = runTest(m.expect);
    const killed = result === "FAILED";
    if (!killed) survived++;
    console.log(`  ${killed ? "KILLED " : "SURVIVED"} ${m.name}\n            → ${m.expect}`);
  } finally {
    restore(m.file);
  }
}

console.log(`\n${MUTATIONS.length - survived}/${MUTATIONS.length} killed, ${survived} survived`);
process.exit(survived ? 1 : 0);
