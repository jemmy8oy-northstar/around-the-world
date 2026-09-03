#!/usr/bin/env node
'use strict';
/**
 * Does each admin rule have a test that FAILS without it?
 *
 *   node frontend/mutate-admin.cjs      (from the repo root, or anywhere)
 *
 * A test written in the same commit as the code it covers proves nothing until
 * you break the code and watch it go red. Every entry below is a rule
 * `Admin.test.tsx` claims to enforce; a SURVIVED line means the claim is
 * unbacked. All 22 tests passed on the first run, before any of this existed —
 * which is exactly the state in which a suite feels finished and isn't.
 *
 * This file is tracked rather than left in a scratch directory on purpose: a
 * "16/16 killed" quoted on a PR and backed by a script nobody else can run is
 * a number, not evidence.
 *
 * It mutates Admin.tsx on disk and restores from an in-memory copy —
 * deliberately NOT `git checkout --`, which reverts to HEAD and would destroy
 * uncommitted work in the file under test. It re-runs the suite after restoring
 * and exits 2 if that is not green, so a crash mid-run cannot leave a mutated
 * Admin.tsx behind looking like a passing tree.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SUBJECT = path.join(ROOT, 'src', 'pages', 'Admin.tsx');
const ORIGINAL = fs.readFileSync(SUBJECT, 'utf8');

const MUTANTS = [
  ['the admin session no longer bypasses the key gate',
    'if (session?.isAdmin) {', 'if (false) {'],
  ['ANY signed-in player bypasses the key gate',
    'if (session?.isAdmin) {', 'if (true) {'],
  ['unlocking does not persist the key, so a remount re-locks',
    'window.sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey);', ';'],
  ['locking leaves the key behind',
    'window.sessionStorage.removeItem(ADMIN_KEY_STORAGE);', ';'],
  ['a non-cooldown failure is retried WITH FORCE',
    "if ((caught as { status?: unknown })?.status !== 409 || !question) {", 'if (false) {'],
  ['the cooldown question is never asked — every 409 forces silently',
    'if (!window.confirm(question)) {', 'if (false) {'],
  ['the first advance already sends force',
    'await advanceStop({ advanceStopRequest: {} }).unwrap();',
    'await advanceStop({ advanceStopRequest: { force: true } }).unwrap();'],
  ['the round reset is rendered once the game is LIVE',
    'const roundResetVisible = game?.mode === "Practice";', 'const roundResetVisible = true;'],
  ['a declined confirmation runs the action anyway',
    'if (confirmText && !window.confirm(confirmText)) return;', ';'],
  ['Unban sends isShadowBanned TRUE — the same thing as a ban',
    'shadowBanRequest: { isShadowBanned: false },', 'shadowBanRequest: { isShadowBanned: true },'],
  ['cutovers are sent as the local string rather than an instant',
    'goLiveAt: new Date(goLiveAt).toISOString(),', 'goLiveAt: goLiveAt,'],
  ['the cutover boxes are never seeded from the game state',
    'setGoLiveAt((current) => current || toLocalInputValue(game.goLiveAt));', ';'],
  ['Save cutovers is enabled with the boxes empty',
    'disabled={!goLiveAt || !readOnlyAt}', 'disabled={false}'],
  ['per-user actions are enabled with no username',
    'disabled={!username}', 'disabled={false}'],
  ['after a rename the box keeps the TYPED name, not the stored one',
    'setUsername(saved);', ';'],
  ['a failed action reports a generic message instead of the server\'s',
    'setMessage(problemDetail(caught) ?? `${label} — failed`);', 'setMessage(`${label} — failed`);'],
];

const run = () => {
  try {
    execFileSync('npx', ['vitest', 'run', 'src/pages/__tests__/Admin.test.tsx'],
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
    return 0;
  } catch (e) {
    const out = String(e.stdout || '') + String(e.stderr || '');
    const m = out.match(/Tests\s+(\d+) failed/);
    return m ? Number(m[1]) : 1;
  }
};

let killed = 0;
const survived = [];
for (const [name, from, to] of MUTANTS) {
  if (!ORIGINAL.includes(from)) {
    console.log(`  ⚠️  ANCHOR MISSING  ${name}`);
    survived.push(name);
    continue;
  }
  fs.writeFileSync(SUBJECT, ORIGINAL.replace(from, to));
  const fails = run();
  fs.writeFileSync(SUBJECT, ORIGINAL);
  if (fails > 0) { killed++; console.log(`  killed (${fails} failing)  ${name}`); }
  else { survived.push(name); console.log(`  SURVIVED               ${name}`); }
}
console.log(`\n${killed}/${MUTANTS.length} killed, ${survived.length} survived`);
if (run() !== 0) { console.error('HARNESS BROKEN: suite not green after restore'); process.exit(2); }
process.exit(survived.length ? 1 : 0);
