import { pathToFileURL } from "node:url";

export function buildPublicConfig(env = {}) {
  if (env.ZK_PUBLIC_HOST && env.ZK_PUBLIC_HOST !== "superchat.komunick.com") {
    throw new Error("ARM07_PUBLIC_HOST_INVALID");
  }
  const port = String(env.ZK_PUBLIC_PORT || "443");
  if (!/^[1-9][0-9]{0,4}$/.test(port) || Number(port) > 65535) {
    throw new Error("ARM07_PUBLIC_PORT_INVALID");
  }
  return {
    BACKEND_PROTOCOL: "https",
    BACKEND_HOST: "superchat.komunick.com",
    BACKEND_PORT: port,
    BACKEND_PATH: "/backend",
    WAVOIP_ENABLED: false
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(JSON.stringify(buildPublicConfig(process.env)) + "\n");
  } catch {
    process.stderr.write("ARM07_PUBLIC_CONFIG_INVALID\n");
    process.exitCode = 1;
  }
}
