const fs = require("node:fs");

// Zap Komunick: image names never come from a registry secret or user input.
function imagePlan({ repository, eventName, ref, publishImages = false }) {
  if (
    typeof repository !== "string" ||
    !/^[a-z0-9][a-z0-9-]*\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/i.test(repository)
  ) {
    throw new Error("Invalid repository namespace");
  }
  const namespace = repository.toLowerCase();
  return {
    backend_image: `ghcr.io/${namespace}-backend`,
    frontend_image: `ghcr.io/${namespace}-frontend`,
    publish_allowed:
      eventName === "workflow_dispatch" &&
      publishImages === true &&
      namespace === "komunick/zap-komunick" &&
      ["refs/heads/dev", "refs/heads/main"].includes(ref),
  };
}

if (require.main === module) {
  const plan = imagePlan({
    repository: process.env.GITHUB_REPOSITORY,
    eventName: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    publishImages: process.env.CI_PUBLISH_IMAGES === "true",
  });
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(plan)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(""),
  );
}

module.exports = { imagePlan };
