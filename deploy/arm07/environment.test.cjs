"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { profiles } = require("./environment.cjs");

test("shell and image profiles agree, with disjoint projects, ports and networks", () => {
  const seen = new Set();
  for (const profile of Object.values(profiles)) {
    const result = spawnSync("bash", ["-c", 'source "$1"; arm07_profile "$2"; printf "%s\\n" "$profile" "$project" "$domain" "$http_port" "$edge_prefix" "$internal_prefix"', "test", path.join(__dirname, "environment.sh"), profile.name], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split("\n"), [profile.name, profile.project, profile.host, profile.port, profile.edge, profile.internal]);
    for (const value of [profile.project, profile.host, profile.port, profile.edge, profile.internal]) {
      assert.equal(seen.has(value), false);
      seen.add(value);
    }
  }
});

test("environment preparation isolates secrets and refuses overwrite or an unselected profile", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "arm07-env-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = [".env", ".env-backend", ".env-bootstrap", "Caddyfile"];
  const invoke = (directory, profile) => spawnSync("bash", [path.join(__dirname, "prepare-env.sh"), directory, "a".repeat(40), "sha256:" + "b".repeat(64), "sha256:" + "c".repeat(64), "admin@example.invalid", profile], { encoding: "utf8" });
  const values = [];
  for (const profile of Object.values(profiles)) {
    const directory = path.join(root, profile.name);
    const result = invoke(directory, profile.name);
    assert.equal(result.status, 0, result.stderr);
    const snapshots = files.map(file => fs.readFileSync(path.join(directory, file), "utf8"));
    for (const file of files) assert.equal(fs.statSync(path.join(directory, file)).mode & 0o777, 0o600);
    assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
    const env = Object.fromEntries(snapshots[0].trim().split("\n").map(line => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
    assert.equal(env.ZK_ENVIRONMENT, profile.name);
    assert.equal(env.COMPOSE_PROJECT_NAME, profile.project);
    assert.equal(env.ZK_PUBLIC_ORIGIN, "https://" + profile.host);
    assert.equal(env.ZK_HTTP_PORT, profile.port);
    assert.equal(snapshots[3], fs.readFileSync(path.join(__dirname, "Caddyfile." + profile.name), "utf8"));
    assert.equal(result.stdout.includes(env.POSTGRES_PASSWORD), false);
    values.push({ password: env.POSTGRES_PASSWORD, master: snapshots[1], admin: snapshots[2] });
    assert.notEqual(invoke(directory, profile.name).status, 0);
    assert.deepEqual(files.map(file => fs.readFileSync(path.join(directory, file), "utf8")), snapshots);
  }
  for (const key of ["password", "master", "admin"]) assert.notEqual(values[0][key], values[1][key]);
  const refused = path.join(root, "refused");
  assert.notEqual(invoke(refused, "dev").status, 0);
  assert.equal(fs.existsSync(refused), false);
  const blocked = path.join(root, "blocked");
  fs.mkdirSync(blocked);
  fs.writeFileSync(path.join(blocked, "Caddyfile"), "existing-file");
  assert.notEqual(invoke(blocked, "production").status, 0);
  assert.deepEqual(fs.readdirSync(blocked), ["Caddyfile"]);
});
