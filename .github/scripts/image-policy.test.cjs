const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { imagePlan } = require("./image-policy.cjs");

const root = path.resolve(__dirname, "../..");
const backendRequire = createRequire(path.join(root, "backend/package.json"));
const yaml = process.env.CI_POLICY_YAML_MODULE
  ? require(process.env.CI_POLICY_YAML_MODULE)
  : backendRequire("js-yaml");
const workflow = yaml.load(
  fs.readFileSync(
    process.env.CI_POLICY_WORKFLOW ||
      path.join(root, ".github/workflows/build-docker.yml"),
    "utf8",
  ),
);

const trusted = {
  repository: "Komunick/zap-komunick",
  eventName: "workflow_dispatch",
  ref: "refs/heads/dev",
  publishImages: true,
};

// Expected results come from the approved event/repository/ref matrix; the
// workflow guard is exercised independently from the policy helper.
const scenarios = [
  ["explicit dev publication", {}, true],
  ["explicit main publication", { ref: "refs/heads/main" }, true],
  ["default dispatch", { publishImages: undefined }, false],
  ["disabled dispatch", { publishImages: false }, false],
  ["string cannot opt in", { publishImages: "true" }, false],
  ["push dev", { eventName: "push" }, false],
  ["push main", { eventName: "push", ref: "refs/heads/main" }, false],
  ["push release tag", { eventName: "push", ref: "refs/tags/v1.2.3" }, false],
  [
    "pull request",
    { eventName: "pull_request", ref: "refs/pull/29/merge" },
    false,
  ],
  ["pull request target", { eventName: "pull_request_target" }, false],
  ["scheduled run", { eventName: "schedule" }, false],
  ["feature branch dispatch", { ref: "refs/heads/codex/example" }, false],
  ["tag dispatch", { ref: "refs/tags/v1.2.3" }, false],
  ["another fork", { repository: "Example/zap-komunick" }, false],
  ["upstream repository", { repository: "ticketz-oss/ticketz" }, false],
];

for (const [name, override, expected] of scenarios) {
  test(`policy matrix: ${name}`, () => {
    assert.equal(
      imagePlan({ ...trusted, ...override }).publish_allowed,
      expected,
    );
  });
}

test("image names use only the current repository in lowercase", () => {
  const plan = imagePlan({ ...trusted, repository: "KOMUNICK/ZAP-KOMUNICK" });
  assert.equal(plan.backend_image, "ghcr.io/komunick/zap-komunick-backend");
  assert.equal(plan.frontend_image, "ghcr.io/komunick/zap-komunick-frontend");
  const fork = imagePlan({ ...trusted, repository: "Example/Fork" });
  assert.equal(fork.backend_image, "ghcr.io/example/fork-backend");
  assert.equal(fork.publish_allowed, false);
});

for (const repository of [
  undefined,
  "",
  "a/b/c",
  "https://example/a",
  "a/b\npublish_allowed=true",
  "a/b:tag",
]) {
  test(`rejects invalid namespace ${JSON.stringify(repository)}`, () => {
    assert.throws(() => imagePlan({ ...trusted, repository }), /namespace/);
  });
}

// This restricted expression evaluator covers the actual job guard rather
// than reproducing its boolean decision in a test-only implementation.
function evaluateGuard(expression, context) {
  assert.equal(typeof expression, "string");
  const source = expression.trim().replace(/^\$\{\{\s*|\s*\}\}$/g, "");
  const fields = {
    "github.event_name": context.eventName,
    "inputs.publish_images": context.publishImages ?? false,
    "github.repository": context.repository,
    "github.ref": context.ref,
  };
  const fieldNames = Object.keys(fields)
    .map((name) => name.replaceAll(".", "\\."))
    .join("|");
  const tokenPattern = new RegExp(
    `\\s*(${fieldNames}|'[^']*'|true|false|==|&&|\\|\\||\\(|\\))`,
    "gy",
  );
  const tokens = [];
  let match;
  while ((match = tokenPattern.exec(source))) tokens.push(match[1]);
  assert.equal(
    tokens.join(""),
    source.replace(/\s+(?=(?:[^']*'[^']*')*[^']*$)/g, ""),
  );
  const translated = tokens
    .map((token) =>
      Object.hasOwn(fields, token) ? JSON.stringify(fields[token]) : token,
    )
    .join(" ");
  return Function(`"use strict"; return (${translated});`)();
}

test("workflow: automatic events validate and manual publishing defaults off", () => {
  assert.ok(Object.hasOwn(workflow.on, "pull_request"));
  assert.ok(workflow.on.push.branches.includes("dev"));
  assert.ok(workflow.on.push.branches.includes("main"));
  assert.equal(Object.hasOwn(workflow.on, "pull_request_target"), false);
  const input = workflow.on.workflow_dispatch.inputs.publish_images;
  assert.equal(input.type, "boolean");
  assert.equal(input.default, false);
  assert.equal(input.required, true);
});

test("workflow: only an explicitly guarded separate job can write packages", () => {
  assert.deepEqual(workflow.permissions, { contents: "read" });
  const writers = Object.entries(workflow.jobs).filter(
    ([, job]) => job.permissions?.packages === "write",
  );
  assert.deepEqual(
    writers.map(([name]) => name),
    ["publish_images"],
  );
  const publish = workflow.jobs.publish_images;
  assert.deepEqual(publish.permissions, {
    contents: "read",
    packages: "write",
  });
  assert.deepEqual([...publish.needs].sort(), [
    "backend_checks",
    "frontend_checks",
  ]);
  for (const [name, override, expected] of scenarios) {
    assert.equal(
      Boolean(evaluateGuard(publish.if, { ...trusted, ...override })),
      expected,
      name,
    );
  }
});

test("workflow: automatic gates cannot run servers, migrations or registry actions", () => {
  const jobs = Object.entries(workflow.jobs).filter(
    ([name]) => name !== "publish_images",
  );
  assert.ok(jobs.length > 0);
  for (const [, job] of jobs) {
    assert.notEqual(job.permissions?.packages, "write");
    assert.ok(job.steps.every((step) => !step.uses?.startsWith("docker/")));
    const commands = job.steps.map((step) => step.run || "").join("\n");
    assert.doesNotMatch(
      commands,
      /\bnpm\s+(?:run\s+)?(?:test|start)\b|sequelize|dist\/server|docker\s+(?:run|compose|push)/,
    );
    assert.match(commands, /npm ci --ignore-scripts/);
    assert.doesNotMatch(JSON.stringify(job), /secrets\./);
    assert.ok(
      job.steps
        .filter((step) => step.uses?.startsWith("actions/checkout@"))
        .every(
          (step) =>
            step.with["persist-credentials"] === false &&
            step.with.ref === "${{ github.sha }}",
        ),
    );
  }
  const frontend = workflow.jobs.frontend_checks;
  const backend = workflow.jobs.backend_checks;
  assert.ok(frontend && backend);
  const install = (job) =>
    job.steps.find((step) => /^npm ci\b/.test(step.run || ""));
  // Browser JS has no native-canvas dependency. Backend media tooling retains
  // its optional packages; neither profile executes install lifecycle scripts.
  assert.match(install(frontend).run, /--omit=optional\b/);
  assert.doesNotMatch(install(backend).run, /--omit=optional\b/);
  assert.equal(
    frontend.steps.find((step) => /test --watchAll/.test(step.run || "")).env
      .CI,
    "true",
  );
});

test("workflow: publishing targets only derived images and source-SHA tags", () => {
  const text = JSON.stringify(workflow);
  assert.doesNotMatch(text, /ticketz-oss|TICKETZ_REGISTRY_URL/);
  const publish = workflow.jobs.publish_images;
  const builders = publish.steps.filter((step) =>
    step.uses?.startsWith("docker/build-push-action@"),
  );
  assert.equal(builders.length, 2);
  assert.ok(builders.every((step) => step.with.push === true));
  assert.ok(
    builders.every((step) => step.with.platforms === "linux/amd64,linux/arm64"),
  );
  assert.deepEqual(
    builders.map((step) => step.with.tags),
    [
      "${{ steps.images.outputs.backend_image }}:sha-${{ github.sha }}",
      "${{ steps.images.outputs.frontend_image }}:sha-${{ github.sha }}",
    ],
  );
  const plan = publish.steps.find((step) => step.id === "images");
  assert.equal(plan.run, "node .github/scripts/image-policy.cjs");
  assert.equal(plan.env.CI_PUBLISH_IMAGES, "${{ inputs.publish_images }}");
});
