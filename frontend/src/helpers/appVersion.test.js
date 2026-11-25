import {
  checkPublishedVersion,
  frontendVersionTag,
  indexAddress,
  mainScriptOf,
  runningMainScript
} from "./appVersion";

const page = main =>
  `<!doctype html><html><head><script defer="defer" src="/static/js/${main}"></script><link href="/static/css/main.0a1b2c3d.css" rel="stylesheet"></head><body><div id="root"></div></body></html>`;

const answer = (body, ok = true) => ({ ok, text: async () => body });

const documentWith = sources => {
  const doc = document.implementation.createHTMLDocument("t");
  sources.forEach(src => {
    const script = doc.createElement("script");
    if (src !== null) script.setAttribute("src", src);
    doc.head.appendChild(script);
  });
  return doc;
};

describe("mainScriptOf", () => {
  it("finds the main script in the published page and in a script address", () => {
    expect(mainScriptOf(page("main.57238d76.js"))).toBe("main.57238d76.js");
    expect(mainScriptOf("/static/js/main.57238d76.js")).toBe(
      "main.57238d76.js"
    );
    expect(
      mainScriptOf("https://cdn.example.invalid/app/static/js/main.AB12cd34.js")
    ).toBe("main.AB12cd34.js");
  });

  it("ignores the other files of the build and what is not a page", () => {
    expect(mainScriptOf("/static/js/453.9f8e7d6c.chunk.js")).toBeNull();
    expect(mainScriptOf("/static/css/main.0a1b2c3d.css")).toBeNull();
    expect(mainScriptOf("/static/js/bundle.js")).toBeNull();
    expect(mainScriptOf('{"revision":"7d0b3ee6"}')).toBeNull();
    expect(mainScriptOf("")).toBeNull();
    expect(mainScriptOf(null)).toBeNull();
    expect(mainScriptOf(undefined)).toBeNull();
  });
});

describe("runningMainScript", () => {
  it("reads the main script the page loaded", () => {
    expect(
      runningMainScript(
        documentWith([
          "https://example.invalid/analytics.js",
          null,
          "/static/js/main.57238d76.js"
        ])
      )
    ).toBe("main.57238d76.js");
  });

  it("is null while developing, where the script has no hash", () => {
    expect(
      runningMainScript(documentWith(["/static/js/bundle.js"]))
    ).toBeNull();
    expect(runningMainScript(documentWith([]))).toBeNull();
  });
});

describe("checkPublishedVersion", () => {
  const running = "main.57238d76.js";

  it("asks for the page without any cache", async () => {
    const fetcher = jest.fn(async () => answer(page(running)));
    await checkPublishedVersion({ running, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [address, options] = fetcher.mock.calls[0];
    expect(address).toBe(indexAddress());
    expect(address).toMatch(/\/index\.html$/);
    expect(options.cache).toBe("no-store");
  });

  it('answers "same" while the published frontend is the one running', async () => {
    const fetcher = async () => answer(page(running));
    await expect(checkPublishedVersion({ running, fetcher })).resolves.toBe(
      "same"
    );
  });

  it('answers "newer" when the published page points at another main script', async () => {
    const fetcher = async () => answer(page("main.99aa00bb.js"));
    await expect(checkPublishedVersion({ running, fetcher })).resolves.toBe(
      "newer"
    );
  });

  it('answers "unknown", never "newer", when it cannot tell', async () => {
    const cases = [
      // the server is restarting
      async () => answer("Bad Gateway", false),
      // a proxy or a captive portal answered something else
      async () => answer("<html><body>Sign in to the network</body></html>"),
      async () => answer(""),
      // offline
      async () => {
        throw new TypeError("Failed to fetch");
      },
      async () => null,
      async () => ({
        ok: true,
        text: async () => {
          throw new Error("aborted");
        }
      })
    ];
    for (const fetcher of cases) {
      // eslint-disable-next-line no-await-in-loop
      await expect(checkPublishedVersion({ running, fetcher })).resolves.toBe(
        "unknown"
      );
    }
  });

  it('gives up, answering "unknown", on a look that never comes back', async () => {
    jest.useFakeTimers();
    let signal;
    const fetcher = jest.fn((address, options) => {
      signal = options.signal;
      return new Promise(() => {});
    });
    const pending = checkPublishedVersion({
      running,
      fetcher,
      timeoutMs: 5000
    });
    jest.advanceTimersByTime(4999);
    expect(signal.aborted).toBe(false);
    jest.advanceTimersByTime(1);
    await expect(pending).resolves.toBe("unknown");
    // the hanging request is cancelled, not left open
    expect(signal.aborted).toBe(true);
    jest.useRealTimers();
  });

  it("leaves no timer behind after a look that answered", async () => {
    jest.useFakeTimers();
    const fetcher = async () => answer(page(running));
    await expect(checkPublishedVersion({ running, fetcher })).resolves.toBe(
      "same"
    );
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it("does not even ask when the page does not know its own script", async () => {
    const fetcher = jest.fn();
    await expect(
      checkPublishedVersion({ running: null, fetcher })
    ).resolves.toBe("unknown");
    await expect(
      checkPublishedVersion({ running, fetcher: null })
    ).resolves.toBe("unknown");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("frontendVersionTag", () => {
  it("is the main script of the page, or a fixed word while developing", () => {
    expect(
      frontendVersionTag(documentWith(["/static/js/main.57238d76.js"]))
    ).toBe("main.57238d76.js");
    // never empty: an empty tag would look like an old frontend to the server
    expect(frontendVersionTag(documentWith(["/static/js/bundle.js"]))).toBe(
      "dev"
    );
    expect(frontendVersionTag(documentWith([]))).toBe("dev");
  });
});
