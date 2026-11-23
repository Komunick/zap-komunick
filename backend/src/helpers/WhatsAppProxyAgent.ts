import { Agent, AgentOptions } from "https";
import createHttpsProxyAgent from "https-proxy-agent";

let configuredProxy: { value: string; agent: Agent };
let configuredHttpAgent: { value: string; agent: Agent };

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
 * Agent for the library's HTTP requests (axios: media upload and download,
 * app state blobs). The native proxyEnv agent works for the WebSocket, but
 * axios requests through it still resolve mmg.whatsapp.net locally and fail
 * with EAI_AGAIN where only the proxy can reach WhatsApp (production,
 * 23/11/2026). https-proxy-agent opens the CONNECT tunnel explicitly.
 */
export function getWhatsAppHttpAgent(): Agent | null {
  const value = process.env.SUPERCHAT_WHATSAPP_PROXY_URL;
  if (!value) return null;
  if (configuredHttpAgent?.value !== value) {
    // same validation as the WebSocket agent (origin, no credentials, Node)
    createWhatsAppProxyAgent(value)?.destroy();
    configuredHttpAgent = {
      value,
      agent: createHttpsProxyAgent(new URL(value).href) as unknown as Agent
    };
  }
  return configuredHttpAgent.agent;
}

/**
 * Axios request options that honor the configured egress proxy. Used for
 * every HTTP request the WhatsApp library makes outside the WebSocket:
 * app state blobs (mmg.whatsapp.net), media and history downloads.
 */
export function getWhatsAppHttpOptions() {
  const httpsAgent = getWhatsAppHttpAgent();
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
