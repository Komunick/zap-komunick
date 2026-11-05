import { Agent, AgentOptions } from "https";

export function createWhatsAppProxyAgent(
  value = process.env.SUPERCHAT_WHATSAPP_PROXY_URL
): Agent | null {
  if (!value) return null;

  const invalidUrl =
    "SUPERCHAT_WHATSAPP_PROXY_URL must be an HTTP(S) proxy origin without credentials";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(invalidUrl);
  }
  if (!/^https?:\/\/[^\s\\/?#@]+\/?$/i.test(value)) {
    throw new Error(invalidUrl);
  }

  // Older Node versions silently ignore proxyEnv. Refuse direct connections
  // when a proxy was explicitly configured.
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (
    major < 22 ||
    (major === 22 && minor < 21) ||
    major === 23 ||
    (major === 24 && minor < 5)
  ) {
    throw new Error(
      "SUPERCHAT_WHATSAPP_PROXY_URL requires Node 22.21+ or 24.5+"
    );
  }

  // The project still compiles against @types/node 17.
  const options: AgentOptions & { proxyEnv: { HTTPS_PROXY: string } } = {
    proxyEnv: { HTTPS_PROXY: url.href }
  };
  return new Agent(options);
}
