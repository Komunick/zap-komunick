"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateRuntimeEnv, validateBootstrapEnv, sameTranslations } = require("./backend-ops.cjs");

const base = () => ({
  ZK_ENVIRONMENT: "production",
  CREDENTIALS_MASTER_KEY: Buffer.alloc(32, 19).toString("base64"),
  DB_PASS: "ARM07-fictional-database-password-123456789",
  NODE_ENV: "production", AI_ASSISTANT_MODE: "disabled", ACESSORIAS_MODE: "disabled",
  SOCKET_ADMIN: "false", FRONTEND_URL: "https://superchat.komunick.com",
  BACKEND_URL: "https://superchat.komunick.com/backend", TRUST_PROXY: "172.29.252.10/32"
});
const admin = () => ({ ADMIN_PASSWORD: "Fictional-ARM07-admin-1234567890", EMAIL_ADDRESS: "admin@example.invalid" });

test("accepts prepared production and isolated TLS QA origins", () => {
  assert.doesNotThrow(() => validateRuntimeEnv(base()));
  assert.doesNotThrow(() => validateRuntimeEnv({ ...base(), FRONTEND_URL: "https://superchat.komunick.com:15443", BACKEND_URL: "https://superchat.komunick.com:15443/backend" }));
});

test("development uses its own host and exact trusted proxy", () => {
  const development = { ...base(), ZK_ENVIRONMENT: "development", FRONTEND_URL: "https://superchatdev.komunick.com", BACKEND_URL: "https://superchatdev.komunick.com/backend", TRUST_PROXY: "172.29.250.10/32" };
  assert.doesNotThrow(() => validateRuntimeEnv(development));
  assert.doesNotThrow(() => validateRuntimeEnv({ ...development, FRONTEND_URL: "https://superchatdev.komunick.com:15444", BACKEND_URL: "https://superchatdev.komunick.com:15444/backend" }));
  assert.throws(() => validateRuntimeEnv({ ...development, FRONTEND_URL: base().FRONTEND_URL, BACKEND_URL: base().BACKEND_URL }), { message: "ARM07_PUBLIC_ORIGIN_INVALID" });
  assert.throws(() => validateRuntimeEnv({ ...development, TRUST_PROXY: base().TRUST_PROXY }), { message: "ARM07_TRUSTED_PROXY_INVALID" });
  assert.throws(() => validateRuntimeEnv({ ...base(), TRUST_PROXY: development.TRUST_PROXY }), { message: "ARM07_TRUSTED_PROXY_INVALID" });
});

test("requires an explicit recognized environment", () => {
  for (const profile of [undefined, "", "dev", "Production", "production\n", "__proto__"]) {
    assert.throws(() => validateRuntimeEnv({ ...base(), ZK_ENVIRONMENT: profile }), { message: "ARM07_ENVIRONMENT_INVALID" });
  }
});
test("refuses missing, malformed and noncanonical master keys", () => {
  for (const key of [undefined, "", "fictional-key", Buffer.alloc(31).toString("base64"), Buffer.alloc(33).toString("base64")]) {
    assert.throws(() => validateRuntimeEnv({ ...base(), CREDENTIALS_MASTER_KEY: key }), { message: "ARM07_MASTER_KEY_INVALID" });
  }
});
test("refuses a weak or multiline database secret without echoing it", () => {
  for (const secret of ["123456", "sensitive-canary\n" + "x".repeat(40)]) {
    assert.throws(() => validateRuntimeEnv({ ...base(), DB_PASS: secret }), { message: "ARM07_DATABASE_SECRET_INVALID" });
  }
});
test("refuses enabled integrations or socket administration", () => {
  for (const key of ["AI_ASSISTANT_MODE", "ACESSORIAS_MODE", "SOCKET_ADMIN"]) {
    assert.throws(() => validateRuntimeEnv({ ...base(), [key]: "true" }), { message: "ARM07_RUNTIME_MODE_INVALID" });
  }
});
test("bootstrap password cannot enter the runtime or migration environment", () => {
  assert.throws(() => validateRuntimeEnv({ ...base(), ...admin() }), { message: "ARM07_RUNTIME_BOOTSTRAP_SECRET_FORBIDDEN" });
  assert.doesNotThrow(() => validateRuntimeEnv({ ...base(), ...admin() }, true));
});
test("refuses alternate hosts, HTTP, credentials, paths and wildcard origins", () => {
  for (const origin of ["http://superchat.komunick.com", "https://other.example.invalid", "https://user:secret@superchat.komunick.com", "https://superchat.komunick.com/path", "https://superchat.komunick.com?canary=secret"]) {
    assert.throws(() => validateRuntimeEnv({ ...base(), FRONTEND_URL: origin, BACKEND_URL: origin + "/backend" }), { message: "ARM07_PUBLIC_ORIGIN_INVALID" });
  }
  assert.throws(() => validateRuntimeEnv({ ...base(), FRONTEND_URL_REGEX: ".*" }), { message: "ARM07_PUBLIC_ORIGIN_INVALID" });
});
test("refuses an unbounded proxy, malformed IPv4 and public proxy address", () => {
  for (const proxy of ["true", "172.16.0.0/12", "172.29.999.10/32", "8.8.8.8/32"]) {
    assert.throws(() => validateRuntimeEnv({ ...base(), TRUST_PROXY: proxy }), { message: "ARM07_TRUSTED_PROXY_INVALID" });
  }
});
test("bootstrap accepts a fictional strong admin and rejects unsafe passwords", () => {
  assert.doesNotThrow(() => validateBootstrapEnv(admin()));
  for (const password of [undefined, "123456", "a".repeat(40), "Strong-canary-123456789\n", "Fictional-ARM07-admin-1234567890 ", "z".repeat(73)]) {
    assert.throws(() => validateBootstrapEnv({ ...admin(), ADMIN_PASSWORD: password }), { message: "ARM07_BOOTSTRAP_ADMIN_INVALID" });
  }
});
test("bootstrap refuses a missing or malformed administrator email", () => {
  for (const email of [undefined, "", "not-an-email", "admin@invalid", "admin@example.invalid\nsecret"]) {
    assert.throws(() => validateBootstrapEnv({ ...admin(), EMAIL_ADDRESS: email }), { message: "ARM07_BOOTSTRAP_EMAIL_INVALID" });
  }
});

test("bootstrap accepts the exact migration dictionary independently of SQL row order", () => {
  const expected = [
    { language: "pt", namespace: "backend", key: "Hello", value: "Olá" },
    { language: "en", namespace: "backend", key: "Hello", value: "Hello" }
  ];
  assert.equal(sameTranslations([...expected].reverse(), expected), true);
});

test("bootstrap refuses missing, additional, duplicate or customized dictionary rows", () => {
  const row = { language: "pt", namespace: "backend", key: "Hello", value: "Olá" };
  const expected = [row];
  for (const actual of [
    [], [row, { ...row, key: "Custom" }], [row, row],
    [{ ...row, value: "conteúdo particular" }], [{ ...row, language: "pt_PT" }],
    [{ ...row, namespace: "custom" }], [{ ...row, key: "Changed" }]
  ]) assert.equal(sameTranslations(actual, expected), false);
});
