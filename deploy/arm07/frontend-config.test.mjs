import test from "node:test";
import assert from "node:assert/strict";
import { buildPublicConfig } from "./frontend-config.mjs";

test("public config contains only the five approved fields", () => {
  const config = buildPublicConfig({ CREDENTIALS_MASTER_KEY: "secret-canary", DB_PASS: "database-canary", ADMIN_PASSWORD: "admin-canary", REACT_APP_BACKEND_URL: "https://evil.example.invalid" });
  assert.deepEqual(config, { BACKEND_PROTOCOL: "https", BACKEND_HOST: "superchat.komunick.com", BACKEND_PORT: "443", BACKEND_PATH: "/backend", WAVOIP_ENABLED: false });
  assert.doesNotMatch(JSON.stringify(config), /canary|evil|password|master/i);
});
test("allows an explicit isolated TLS QA port without widening the host", () => {
  assert.equal(buildPublicConfig({ ZK_PUBLIC_PORT: "15443" }).BACKEND_PORT, "15443");
  assert.throws(() => buildPublicConfig({ ZK_PUBLIC_HOST: "superchat.komunick.com.evil.invalid" }), { message: "ARM07_PUBLIC_HOST_INVALID" });
});
test("refuses malformed ports and control characters", () => {
  for (const port of ["0", "65536", "443\n", "443;secret", "-1", "00443"]) {
    assert.throws(() => buildPublicConfig({ ZK_PUBLIC_PORT: port }), { message: "ARM07_PUBLIC_PORT_INVALID" });
  }
});
