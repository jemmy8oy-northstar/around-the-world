// Frontend counterpart of tmp-mutate.mjs: break one rule, require the named
// test to go RED, restore from git either way.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "/data/repos/around-the-world";

const MUTATIONS = [
  {
    name: "the admin tab is shown to everyone",
    file: "frontend/src/components/TabBar.tsx",
    find: "const tabs = session?.isAdmin ? [...TABS, ADMIN_TAB] : TABS;",
    replace: "const tabs = [...TABS, ADMIN_TAB];",
    expect: "shows the four player tabs and no admin tab",
  },
  {
    name: "the tab grid stays hard-coded at four columns",
    file: "frontend/src/components/TabBar.tsx",
    find: 'style={{ "--tabbar-columns": tabs.length } as CSSProperties}',
    replace: 'style={{ "--tabbar-columns": 4 } as CSSProperties}',
    expect: "widens the grid to fit the tabs it actually renders",
  },
  {
    name: "the hidden badge is not gated on being the admin",
    file: "frontend/src/components/PostList.tsx",
    find: "canModerate && banned.has((post.username ?? \"\").toLowerCase())",
    replace: "banned.has((post.username ?? \"\").toLowerCase())",
    expect: "does not mark a post as hidden for an ordinary player",
  },
  {
    name: "the options menu is offered to every player",
    file: "frontend/src/components/PostCard.tsx",
    find: "if (canModerate && post.id) {",
    replace: "if (post.id) {",
    expect: "gives an ordinary player no options menu at all",
  },
  {
    name: "shadow-banning yourself is offered",
    file: "frontend/src/components/PostCard.tsx",
    find: "if (canModerate && post.username && !canDelete) {",
    replace: "if (canModerate && post.username) {",
    expect: "does not offer to shadow ban yourself",
  },
  {
    name: "a timestamp with no timezone is read as local rather than UTC",
    file: "frontend/src/pages/adminTime.ts",
    find: "const instant = new Date(hasTimezone ? iso : `${iso}Z`);",
    replace: "const instant = new Date(iso);",
    expect: "treats a timestamp with no designator as UTC, not as local",
  },
  {
    name: "the box is filled from UTC rather than local parts",
    file: "frontend/src/pages/adminTime.ts",
    find: "`${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}` +",
    replace: "`${instant.getUTCFullYear()}-${pad(instant.getUTCMonth() + 1)}-${pad(instant.getUTCDate())}` +",
    expect: "rolls the date over when the local time crosses midnight",
  },
  {
    name: "the clock is filled from UTC rather than local parts",
    file: "frontend/src/pages/adminTime.ts",
    find: "`T${pad(instant.getHours())}:${pad(instant.getMinutes())}`",
    replace: "`T${pad(instant.getUTCHours())}:${pad(instant.getUTCMinutes())}`",
    expect: "shows a 16:00Z cutover as 17:00, which is what BST calls it",
  },
  {
    name: "a session stored before the admin flag existed reads as truthy",
    file: "frontend/src/auth/tokenStorage.ts",
    find: "return { ...parsed, isAdmin: parsed.isAdmin === true } as StoredSession;",
    replace: "return parsed as StoredSession;",
    expect: "reads a session stored before the admin flag existed as not an admin",
  },
];

function restore(file) {
  execFileSync("git", ["-C", ROOT, "checkout", "--", file]);
}

function runTest(filter) {
  try {
    execFileSync("npx", ["vitest", "run", "-t", filter], {
      cwd: `${ROOT}/frontend`,
      stdio: "pipe",
      timeout: 600_000,
    });
    return "PASSED";
  } catch {
    return "FAILED";
  }
}

let survived = 0;

console.log("control (no mutation):");
for (const m of MUTATIONS) {
  const result = runTest(m.expect);
  console.log(`  ${result === "PASSED" ? "ok" : "BROKEN"}  ${m.expect}`);
  if (result !== "PASSED") survived++;
}
if (survived) {
  console.log("\ncontrol failed — aborting");
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
    const killed = runTest(m.expect) === "FAILED";
    if (!killed) survived++;
    console.log(`  ${killed ? "KILLED " : "SURVIVED"} ${m.name}`);
  } finally {
    restore(m.file);
  }
}

console.log(`\n${MUTATIONS.length - survived}/${MUTATIONS.length} killed, ${survived} survived`);
process.exit(survived ? 1 : 0);
