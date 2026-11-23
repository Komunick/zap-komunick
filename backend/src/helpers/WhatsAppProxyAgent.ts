import { Agent, AgentOptions } from "https";

let configuredProxy: { value: string; agent: Agent };

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

export function getWhatsAppProxyAgent(): Agent | null {
  const value = process.env.SUPERCHAT_WHATSAPP_PROXY_URL;
  if (!value) return null;
  if (configuredProxy?.value !== value) {
    configuredProxy = { value, agent: createWhatsAppProxyAgent(value) };
  }
  return configuredProxy.agent;
}

/**
 * Axios request options that honor the configured egress proxy. Used for
 * every HTTP request the WhatsApp library makes outside the WebSocket:
 * app state blobs (mmg.whatsapp.net), media and history downloads.
 */
export function getWhatsAppHttpOptions() {
  const httpsAgent = getWhatsAppProxyAgent();
  if (!httpsAgent) return undefined;
  return {
    httpsAgent,
    proxy: false as const,
    beforeRedirect: ({ protocol }: { protocol?: string }) => {
      if (protocol !== "https:") {
        throw new Error("WhatsApp media redirects must use HTTPS");
      }
    }
  };
}

export function getWhatsAppMediaDownloadOptions() {
  const options = getWhatsAppHttpOptions();
  if (!options) return undefined;
  return { options };
}
