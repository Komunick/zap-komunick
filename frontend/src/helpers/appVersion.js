// Zap Komunick: is the page running the frontend that is published right now?
// (docs/PRD.md, RF-032). Whoever keeps the SuperChat open all day keeps running
// the JavaScript the browser loaded in the morning: a publication made at 10 am
// only reaches them when the page is loaded again.
//
// The signal is the name of the main script. The build names it after its
// content (`main.<hash>.js`), the published `index.html` points at the current
// one and is never cached (`Cache-Control: no-store`), and the page knows which
// one it loaded. Different names = a newer frontend is published. It needs no
// file of the deploy and no route of the backend, so it works on any install.

const MAIN_SCRIPT = /static\/js\/(main\.[0-9a-z_-]+\.js)/i;

// The main script named in a piece of HTML (or in a script address), or null.
export const mainScriptOf = text => {
  if (typeof text !== "string") return null;
  const match = text.match(MAIN_SCRIPT);
  return match ? match[1] : null;
};

// The main script this page is running. Null while developing (the dev server
// serves `bundle.js`, with no hash): then nothing is ever compared.
export const runningMainScript = (doc = document) => {
  const scripts = Array.from(doc.querySelectorAll("script[src]"));
  for (const script of scripts) {
    const name = mainScriptOf(script.getAttribute("src"));
    if (name) return name;
  }
  return null;
};

// What the page tells the server when it connects (`fv` in the socket
// handshake): any value means "I notice a publication by myself". A frontend
// from before RF-032 sends nothing, and the server asks it for F5
// (backend/src/helpers/LegacyClientNotice.ts).
export const frontendVersionTag = (doc = document) =>
  runningMainScript(doc) || "dev";

// A route asked for a file of the previous publication (routes/
// LazyRouteContent.js): a sure sign that a newer frontend is published.
export const UPDATE_AVAILABLE_EVENT = "superchat:update-available";

export const indexAddress = () => `${process.env.PUBLIC_URL || ""}/index.html`;

// "newer": the published frontend is not the one running. "same": it is.
// "unknown": could not tell (offline, the server is restarting, a proxy answered
// something else, development). Only "newer" ever shows anything to the person.
// A look that never comes back (a connection that hangs) must not hold the
// next ones: it is given up after this long.
export const VERSION_CHECK_TIMEOUT_MS = 15 * 1000;

export const checkPublishedVersion = async ({
  running = runningMainScript(),
  fetcher = typeof fetch === "function" ? fetch.bind(window) : null,
  timeoutMs = VERSION_CHECK_TIMEOUT_MS
} = {}) => {
  if (!running || !fetcher) return "unknown";
  const controller =
    typeof AbortController === "function" ? new AbortController() : null;
  let gaveUp = null;
  const timeout = new Promise(resolve => {
    gaveUp = setTimeout(() => {
      controller?.abort();
      resolve("unknown");
    }, timeoutMs);
  });
  const look = (async () => {
    try {
      const response = await fetcher(indexAddress(), {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "text/html" },
        signal: controller?.signal
      });
      if (!response || !response.ok) return "unknown";
      const published = mainScriptOf(await response.text());
      if (!published) return "unknown";
      return published === running ? "same" : "newer";
    } catch {
      return "unknown";
    }
  })();
  try {
    return await Promise.race([look, timeout]);
  } finally {
    clearTimeout(gaveUp);
  }
};
