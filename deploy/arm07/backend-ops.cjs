"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { deploymentProfile } = require("./environment.cjs");

const ROOT = path.resolve(__dirname, "..");
const LOCK_ID = 270720261;
const SEEDS = [
  "20200904070005-create-default-company.js",
  "20200904070006-create-default-user.js",
  "20200904070007-create-default-settings.js"
];
const TRANSLATION_MIGRATIONS = [
  "20250813194700-reload-all-translations.js",
  "20260507113000-add-translation-for-message-edit-error.js",
  "20260526110000-add-translations-for-wbot-monitor-calls.js"
];

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function isMaster(value) {
  return typeof value === "string" && /^[A-Za-z0-9+/]{43}=$/.test(value) &&
    Buffer.from(value, "base64").length === 32 &&
    Buffer.from(value, "base64").toString("base64") === value;
}

function validateRuntimeEnv(env, allowBootstrapSecret = false) {
  const profile = deploymentProfile(env.ZK_ENVIRONMENT);
  if (!isMaster(env.CREDENTIALS_MASTER_KEY) ||
      (env.CREDENTIALS_PREVIOUS_MASTER_KEY && !isMaster(env.CREDENTIALS_PREVIOUS_MASTER_KEY))) {
    fail("ARM07_MASTER_KEY_INVALID");
  }
  if (typeof env.DB_PASS !== "string" || env.DB_PASS.length < 32 ||
      env.DB_PASS.length > 256 || /[\r\n\0]/.test(env.DB_PASS)) {
    fail("ARM07_DATABASE_SECRET_INVALID");
  }
  if (env.NODE_ENV !== "production" || env.AI_ASSISTANT_MODE !== "disabled" ||
      env.ACESSORIAS_MODE !== "disabled" || env.SOCKET_ADMIN !== "false") {
    fail("ARM07_RUNTIME_MODE_INVALID");
  }
  if (!allowBootstrapSecret && env.ADMIN_PASSWORD) fail("ARM07_RUNTIME_BOOTSTRAP_SECRET_FORBIDDEN");
  let origin;
  try {
    const parsed = new URL(env.FRONTEND_URL);
    if (parsed.protocol !== "https:" || parsed.hostname !== profile.host ||
        parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      fail("ARM07_PUBLIC_ORIGIN_INVALID");
    }
    origin = parsed.origin;
  } catch {
    fail("ARM07_PUBLIC_ORIGIN_INVALID");
  }
  if (env.FRONTEND_URL !== origin || env.BACKEND_URL !== origin + "/backend" ||
      env.FRONTEND_CUSTOM_URL || env.FRONTEND_URL_REGEX) {
    fail("ARM07_PUBLIC_ORIGIN_INVALID");
  }
  if (env.TRUST_PROXY !== profile.internal + ".10/32") {
    fail("ARM07_TRUSTED_PROXY_INVALID");
  }
}

function validateBootstrapEnv(env) {
  const password = env.ADMIN_PASSWORD;
  const bytes = typeof password === "string" ? Buffer.byteLength(password, "utf8") : 0;
  if (bytes < 24 || bytes > 72 || /[\r\n\0]/.test(password || "") ||
      new Set(password).size < 8 || password.trim() !== password) {
    fail("ARM07_BOOTSTRAP_ADMIN_INVALID");
  }
  if (typeof env.EMAIL_ADDRESS !== "string" || env.EMAIL_ADDRESS.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.EMAIL_ADDRESS)) {
    fail("ARM07_BOOTSTRAP_EMAIL_INVALID");
  }
}

function metadata() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "deployment.json"), "utf8"));
  if (!/^[a-f0-9]{40}$/.test(data.revision || "") ||
      data.revision !== process.env.SOURCE_REVISION ||
      (process.env.ZK_REVISION && process.env.ZK_REVISION !== data.revision)) {
    fail("ARM07_REVISION_MISMATCH");
  }
  return data;
}

function database() {
  const { Sequelize } = require("sequelize");
  const config = require(path.join(ROOT, "dist/config/database.js"));
  return new Sequelize({ ...config, logging: false, pool: { max: 1, min: 0, acquire: 30000, idle: 1000 } });
}

function identifier(name) {
  return '"' + name.replace(/"/g, '""') + '"';
}

async function assertMigrations(sequelize, transaction) {
  const expected = fs.readdirSync(path.join(ROOT, "dist/database/migrations"))
    .filter(name => name.endsWith(".js")).sort();
  const [rows] = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name', { transaction });
  if (JSON.stringify(rows.map(row => row.name)) !== JSON.stringify(expected)) {
    fail("ARM07_BOOTSTRAP_MIGRATIONS_REQUIRED");
  }
}

function sameTranslations(actual, expected) {
  const canonical = rows => rows.map(row => JSON.stringify([
    row.language, row.namespace, row.key, row.value
  ])).sort();
  return JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected));
}

async function expectedTranslations() {
  // These three reviewed migrations create application-owned dictionary data in
  // an otherwise empty schema. Replay only their translation operations in memory
  // so the bootstrap accepts the exact image baseline, never arbitrary metadata.
  const { Op } = require("sequelize");
  const rows = new Map();
  const transaction = { commit: async () => {}, rollback: async () => {} };
  const memoryInterface = {
    sequelize: { transaction: async () => transaction },
    bulkDelete: async (table, where) => {
      if (table !== "Translations" || where.namespace !== "backend" || !Array.isArray(where[Op.or])) {
        fail("ARM07_BOOTSTRAP_TRANSLATION_BASELINE_INVALID");
      }
      for (const criterion of where[Op.or]) {
        const keys = criterion.key?.[Op.in];
        if (typeof criterion.language !== "string" || !Array.isArray(keys)) {
          fail("ARM07_BOOTSTRAP_TRANSLATION_BASELINE_INVALID");
        }
        for (const key of keys) rows.delete(JSON.stringify([criterion.language, where.namespace, key]));
      }
    },
    bulkInsert: async (table, records) => {
      if (table !== "Translations" || !Array.isArray(records)) fail("ARM07_BOOTSTRAP_TRANSLATION_BASELINE_INVALID");
      for (const row of records) {
        if (row.namespace !== "backend" || [row.language, row.namespace, row.key, row.value].some(value => typeof value !== "string")) {
          fail("ARM07_BOOTSTRAP_TRANSLATION_BASELINE_INVALID");
        }
        rows.set(JSON.stringify([row.language, row.namespace, row.key]), { ...row });
      }
    }
  };
  for (const name of TRANSLATION_MIGRATIONS) {
    const migration = require(path.join(ROOT, "dist/database/migrations", name));
    await (migration.default || migration).up(memoryInterface);
  }
  return [...rows.values()];
}

async function bootstrap(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  await sequelize.transaction(async transaction => {
    await sequelize.query("SELECT pg_advisory_xact_lock(:lock)", { replacements: { lock: LOCK_ID }, transaction });
    await assertMigrations(sequelize, transaction);
    const [tables] = await sequelize.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'SequelizeMeta' ORDER BY tablename",
      { transaction }
    );
    if (tables.length === 0) fail("ARM07_BOOTSTRAP_MIGRATIONS_REQUIRED");
    for (const { tablename } of tables) {
      await sequelize.query("LOCK TABLE " + identifier(tablename) + " IN EXCLUSIVE MODE", { transaction });
      if (tablename === "Translations") {
        const [actual] = await sequelize.query('SELECT language, namespace, key, value FROM "Translations"', { transaction });
        if (!sameTranslations(actual, await expectedTranslations())) fail("ARM07_BOOTSTRAP_TRANSLATIONS_NOT_PRISTINE");
        continue;
      }
      const [rows] = await sequelize.query("SELECT EXISTS(SELECT 1 FROM " + identifier(tablename) + " LIMIT 1) AS populated", { transaction });
      if (rows[0].populated) fail("ARM07_BOOTSTRAP_DATABASE_NOT_EMPTY");
    }
    // The inherited seeders refer explicitly to company/plan 1. An aborted old
    // bootstrap can advance PostgreSQL sequences even when its rows rolled back.
    for (const table of ["Plans", "Companies", "Users"]) {
      const [sequences] = await sequelize.query("SELECT pg_get_serial_sequence(:table, 'id') AS name", {
        replacements: { table: identifier(table) }, transaction
      });
      const sequence = sequences[0].name;
      if (!sequence || !/^(?:public\.)?"?[A-Za-z0-9_]+"?$/.test(sequence)) fail("ARM07_BOOTSTRAP_SEQUENCE_INVALID");
      const [rows] = await sequelize.query("SELECT last_value, is_called FROM " + sequence, { transaction });
      if (rows[0].is_called || String(rows[0].last_value) !== "1") fail("ARM07_BOOTSTRAP_DATABASE_NOT_FRESH");
    }
    await sequelize.query('CREATE TABLE IF NOT EXISTS "SequelizeData" (name VARCHAR(255) PRIMARY KEY)', { transaction });
    // Reuse exactly the three reviewed seeders, while making their transaction
    // callbacks use this single transaction. No seed commits independently.
    const seedInterface = {
      sequelize: { transaction: callback => Promise.resolve(callback(transaction)) },
      bulkInsert: (table, rows, options = {}) => queryInterface.bulkInsert(table, rows, { ...options, transaction })
    };
    for (const name of SEEDS) {
      const seed = require(path.join(ROOT, "dist/database/seeds", name));
      await seed.up(seedInterface);
      await sequelize.query('INSERT INTO "SequelizeData" (name) VALUES (:name)', { replacements: { name }, transaction });
    }
  });
}

async function migrate(sequelize) {
  await sequelize.query("SELECT pg_advisory_lock(:lock)", { replacements: { lock: LOCK_ID } });
  try {
    const cli = require.resolve("sequelize-cli/lib/sequelize");
    const result = spawnSync(process.execPath, [cli, "db:migrate", "--config", "dist/config/database.js", "--migrations-path", "dist/database/migrations"], {
      cwd: ROOT, env: process.env, encoding: "utf8", maxBuffer: 16 * 1024 * 1024
    });
    // CLI errors can include SQL or connection values: report only a stable code.
    if (result.status !== 0 || result.error) fail("ARM07_MIGRATION_FAILED");
  } finally {
    await sequelize.query("SELECT pg_advisory_unlock(:lock)", { replacements: { lock: LOCK_ID } });
  }
}

function checkNative() {
  const data = metadata();
  if (process.arch !== "arm64") fail("ARM07_ARCHITECTURE_INVALID");
  const ffmpeg = require("@ffmpeg-installer/ffmpeg").path;
  const result = spawnSync(ffmpeg, ["-version"], { encoding: "utf8", timeout: 10000 });
  if (result.status !== 0 || result.error) fail("ARM07_FFMPEG_INVALID");
  const { Resvg } = require("@resvg/resvg-js");
  const png = new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="green"/></svg>').render().asPng();
  if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) fail("ARM07_RESVG_INVALID");
  process.stdout.write(JSON.stringify({ architecture: process.arch, revision: data.revision, ffmpeg: true, resvg: true }) + "\n");
}

async function main(mode = process.argv[2] || "run") {
  if (!new Set(["run", "migrate", "bootstrap", "check"]).has(mode)) fail("ARM07_OPERATION_INVALID");
  process.chdir(ROOT);
  metadata();
  if (mode === "check") return checkNative();
  validateRuntimeEnv(process.env, mode === "bootstrap");
  if (mode === "bootstrap") validateBootstrapEnv(process.env);
  if (mode === "run") {
    require(path.join(ROOT, "dist/server.js"));
    return;
  }
  const sequelize = database();
  try {
    await sequelize.authenticate();
    if (mode === "bootstrap") await bootstrap(sequelize);
    else await migrate(sequelize);
    process.stdout.write(mode === "bootstrap" ? "ARM07_BOOTSTRAP_COMPLETE\n" : "ARM07_MIGRATION_COMPLETE\n");
  } finally {
    await sequelize.close();
  }
}

module.exports = { validateRuntimeEnv, validateBootstrapEnv, sameTranslations, expectedTranslations, bootstrap, SEEDS, main };

if (require.main === module) {
  main().catch(error => {
    const code = /^ARM07_[A-Z_]+$/.test(error.code || "") ? error.code : "ARM07_OPERATION_FAILED";
    process.stderr.write(code + "\n");
    process.exitCode = 1;
  });
}
