import {
  FEATURE_TOUR_EVENT,
  buildTourSteps,
  featureTourAnswered,
  featureTourKey,
  isOnTourRoute,
  rememberFeatureTour,
  tourStepContent
} from "./featureTour";
import { komunickMessages } from "../translate/languages/komunick";

jest.mock("../translate/i18n", () => ({
  i18n: { t: jest.fn() }
}));

const { i18n } = require("../translate/i18n");

const ids = steps => steps.map(step => step.id);

beforeEach(() => {
  localStorage.clear();
  i18n.t.mockReset();
});

describe("buildTourSteps", () => {
  it("gives an agent the service pages and the top bar, in menu order", () => {
    expect(ids(buildTourSteps())).toEqual([
      "tickets",
      "ticketsList",
      "ticketsChat",
      "kanban",
      "quickMessages",
      "contacts",
      "schedules",
      "tags",
      "chats",
      "support",
      "search",
      "account"
    ]);
  });

  it("adds the management and administration pages for an administrator", () => {
    const admin = buildTourSteps({ isAdmin: true });
    expect(ids(admin)).toEqual([
      "tickets",
      "ticketsList",
      "ticketsChat",
      "kanban",
      "quickMessages",
      "contacts",
      "schedules",
      "tags",
      "chats",
      "support",
      "indicators",
      "security",
      "connections",
      "queues",
      "users",
      "settings",
      "search",
      "account"
    ]);
    // nothing an agent's menu does not have reaches an agent
    const agentIds = ids(buildTourSteps({ isAdmin: false }));
    admin
      .filter(step => step.admin)
      .forEach(step => expect(agentIds).not.toContain(step.id));
  });

  it("gives every step what the screen needs", () => {
    const steps = buildTourSteps({ isAdmin: true });
    expect(new Set(ids(steps)).size).toBe(steps.length);
    steps.forEach(step => {
      expect(step.targets.length).toBeGreaterThan(0);
      expect(["right", "left", "below", "above"]).toContain(step.side);
      expect(typeof step.inMenu).toBe("boolean");
      expect(step.route === null || step.route.startsWith("/")).toBe(true);
      expect(step.group).toBeTruthy();
    });
  });

  it("points menu steps at the marks of the side menu and of the tabs", () => {
    const byId = Object.fromEntries(
      buildTourSteps({ isAdmin: true }).map(step => [step.id, step])
    );
    expect(byId.tickets.targets).toEqual(["nav:/tickets"]);
    expect(byId.indicators.targets).toEqual([
      "nav:/",
      "nav:/sla",
      "nav:/metrics",
      "nav:/users-online"
    ]);
    // steps about a part of a page, or of the top bar, never fall back to the
    // "More" tab
    ["ticketsList", "ticketsChat", "search", "account"].forEach(id =>
      expect(byId[id].inMenu).toBe(false)
    );
    expect(byId.connections.inMenu).toBe(true);
    // the top bar steps do not leave the page the person is on
    expect(byId.search.route).toBeNull();
    expect(byId.account.route).toBeNull();
  });
});

describe("isOnTourRoute", () => {
  it("knows when the page of the step is already on screen", () => {
    expect(isOnTourRoute("/tickets", "/tickets")).toBe(true);
    expect(isOnTourRoute("/tickets/abc-123", "/tickets")).toBe(true);
    expect(isOnTourRoute("/tickets-advanced", "/tickets")).toBe(false);
    expect(isOnTourRoute("/kanban", "/tickets")).toBe(false);
    expect(isOnTourRoute("/", "/")).toBe(true);
    expect(isOnTourRoute("/sla", "/")).toBe(false);
    expect(isOnTourRoute("/anything", null)).toBe(true);
  });
});

describe("the answer to the offer", () => {
  it("is kept per user", () => {
    expect(featureTourAnswered(7)).toBe(false);
    rememberFeatureTour(7, "done");
    expect(featureTourAnswered(7)).toBe(true);
    expect(featureTourAnswered(8)).toBe(false);
    expect(JSON.parse(localStorage.getItem(featureTourKey(7))).answer).toBe(
      "done"
    );
  });

  it("skips the offer when the storage is blocked", () => {
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(featureTourAnswered(7)).toBe(true);
    expect(() => rememberFeatureTour(7, "later")).not.toThrow();
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("has an event name to ask for the tour", () => {
    expect(FEATURE_TOUR_EVENT).toBe("superchat:feature-tour");
  });
});

describe("tourStepContent", () => {
  it("reads the title, the text, the points and the menu group of the step", () => {
    i18n.t.mockImplementation((key, options) =>
      options?.returnObjects ? ["um", "dois", 3, null] : `t(${key})`
    );
    const [step] = buildTourSteps();
    expect(tourStepContent(step)).toEqual({
      where: "t(featureTour.groups.service)",
      title: "t(featureTour.steps.tickets.title)",
      text: "t(featureTour.steps.tickets.text)",
      points: ["um", "dois"]
    });
  });

  it("shows no points when the translation has none", () => {
    i18n.t.mockImplementation(key => key);
    expect(tourStepContent(buildTourSteps()[0]).points).toEqual([]);
  });
});

// Every step and every button of the tour has its text in the three
// languages: a missing key would show up on screen as the key itself.
describe.each(["pt", "pt_PT", "en", "es"])("the texts in %s", language => {
  const tour = komunickMessages[language].translations.featureTour;
  const steps = buildTourSteps({ isAdmin: true });

  it("cover every step", () => {
    steps.forEach(step => {
      const texts = tour.steps[step.id];
      expect(texts).toBeDefined();
      expect(texts.title.trim()).not.toBe("");
      expect(texts.text.trim()).not.toBe("");
      expect(Array.isArray(texts.points)).toBe(true);
      expect(texts.points.length).toBeGreaterThanOrEqual(2);
      expect(texts.points.length).toBeLessThanOrEqual(4);
      texts.points.forEach(point => {
        expect(typeof point).toBe("string");
        expect(point.trim()).not.toBe("");
      });
      // the points are the React keys of the list
      expect(new Set(texts.points).size).toBe(texts.points.length);
      expect(tour.groups[step.group].trim()).not.toBe("");
    });
    // and there is no text left behind for a step that no longer exists
    expect(Object.keys(tour.steps).sort()).toEqual(ids(steps).sort());
  });

  it("cover the offer, the buttons and the final screen", () => {
    [
      "menu",
      "title",
      "stepOf",
      "stepShort",
      "leave",
      "back",
      "next",
      "finish",
      "offerTitle",
      "offerText",
      "offerLater",
      "notNow",
      "start",
      "endTitle",
      "endText",
      "conclude",
      "repeat"
    ].forEach(key => expect(tour[key].trim()).not.toBe(""));
    expect(tour.stepOf).toContain("{{n}}");
    expect(tour.stepOf).toContain("{{total}}");
    expect(tour.stepShort).toContain("{{n}}");
    expect(tour.stepShort).toContain("{{total}}");
    expect(tour.offerText).toContain("{{total}}");
  });
});

it("keeps the same steps in the three languages", () => {
  const stepIds = language =>
    Object.keys(
      komunickMessages[language].translations.featureTour.steps
    ).sort();
  expect(stepIds("en")).toEqual(stepIds("pt"));
  expect(stepIds("es")).toEqual(stepIds("pt"));
  ["en", "es"].forEach(language =>
    stepIds("pt").forEach(id =>
      expect(
        komunickMessages[language].translations.featureTour.steps[id].points
      ).toHaveLength(
        komunickMessages.pt.translations.featureTour.steps[id].points.length
      )
    )
  );
});
