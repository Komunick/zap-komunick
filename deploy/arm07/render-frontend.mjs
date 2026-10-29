import fs from "node:fs";
import { buildPublicConfig } from "./frontend-config.mjs";
import environment from "./environment.cjs";

const profile = environment.deploymentProfile(process.env.ZK_ENVIRONMENT);
const revision = process.env.SOURCE_REVISION;
if (!/^[a-f0-9]{40}$/.test(revision || "") || process.env.ZK_PUBLIC_HOST !== profile.host) {
  throw new Error("ARM07_FRONTEND_BUILD_INVALID");
}
const config = buildPublicConfig(process.env);
if (config.BACKEND_PORT !== "443") throw new Error("ARM07_FRONTEND_BUILD_INVALID");
const template = fs.readFileSync("deploy/nginx.conf", "utf8");
if (!template.includes("__ARM07_HOST__") || !template.includes("__ARM07_EDGE_GATEWAY__")) {
  throw new Error("ARM07_NGINX_TEMPLATE_INVALID");
}
fs.writeFileSync("build/config.json", JSON.stringify(config) + "\n");
fs.writeFileSync("build/nginx.conf", template.replaceAll("__ARM07_HOST__", profile.host).replaceAll("__ARM07_EDGE_GATEWAY__", profile.edge + ".1"));
fs.writeFileSync("build/deployment.json", JSON.stringify({ application: "Zap Komunick", revision, environment: profile.name, host: profile.host, platform: "linux/arm64", source: "https://github.com/Komunick/zap-komunick/tree/" + revision }) + "\n");
