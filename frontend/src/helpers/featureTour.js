import { i18n } from "../translate/i18n";

// Zap Komunick: the script of the feature tour, without screen (docs/PRD.md,
// RF-031). Which steps exist, in which order, which page each one opens and
// what it points at. The texts live in the translations, under
// `featureTour.steps.<id>` (title, text and the "how it works" points).
//
// ── TO ADD A STEP ────────────────────────────────────────────────────────────
//
// 1. A line in `STEPS` below, in the place where it should show up.
// 2. Its texts in the three languages (`translate/languages/komunick.js`); the
//    test in `helpers/featureTour.test.js` fails when one is missing.
// 3. When it points at something that is not a menu item, the `data-tour` mark
//    on that element.

// Asks for the tour from anywhere ("Tour pelo sistema" in the user menu).
export const FEATURE_TOUR_EVENT = "superchat:feature-tour";

// The answer to the offer, kept in this browser per user. Change the version
// to offer the tour to everyone again.
export const featureTourKey = userId => `superchat:featureTour:v1:${userId}`;

// The "More" tab of the tabs layout, where the less used pages are.
export const TOUR_MORE_TARGET = "nav:more";

const nav = route => `nav:${route}`;

// `route`: the page the step opens. `targets`: the `data-tour` marks it lights
// up (several = one spotlight around all of them). `inMenu`: the step is about
// menu items, so the "More" tab stands in for them when they are not on
// screen. `group`: the part of the menu the balloon names. `side`: where the
// balloon would rather be.
const STEPS = [
  {
    id: "tickets",
    group: "service",
    route: "/tickets",
    targets: [nav("/tickets")]
  },
  {
    id: "ticketsList",
    group: "service",
    route: "/tickets",
    targets: ["tickets:tabs", "tickets:actions"],
    inMenu: false
  },
  {
    id: "ticketsChat",
    group: "service",
    route: "/tickets",
    targets: ["tickets:chat"],
    inMenu: false,
    side: "left"
  },
  {
    id: "kanban",
    group: "service",
    route: "/kanban",
    targets: [nav("/kanban")]
  },
  {
    id: "quickMessages",
    group: "service",
    route: "/quick-messages",
    targets: [nav("/quick-messages")]
  },
  {
    id: "contacts",
    group: "service",
    route: "/contacts",
    targets: [nav("/contacts")]
  },
  {
    id: "schedules",
    group: "service",
    route: "/schedules",
    targets: [nav("/schedules")]
  },
  { id: "tags", group: "service", route: "/tags", targets: [nav("/tags")] },
  { id: "chats", group: "service", route: "/chats", targets: [nav("/chats")] },
  {
    id: "support",
    group: "service",
    route: "/support",
    targets: [nav("/helps"), nav("/support")]
  },
  {
    id: "indicators",
    group: "management",
    admin: true,
    route: "/",
    targets: [nav("/"), nav("/sla"), nav("/metrics"), nav("/users-online")]
  },
  {
    id: "security",
    group: "management",
    admin: true,
    route: "/audit-logs",
    targets: [nav("/ip-allowlist"), nav("/audit-logs")]
  },
  {
    id: "connections",
    group: "administration",
    admin: true,
    route: "/connections",
    targets: [nav("/connections")]
  },
  {
    id: "queues",
    group: "administration",
    admin: true,
    route: "/queues",
    targets: [nav("/queues"), nav("/close-reasons")]
  },
  {
    id: "users",
    group: "administration",
    admin: true,
    route: "/users",
    targets: [nav("/users")]
  },
  {
    id: "settings",
    group: "administration",
    admin: true,
    route: "/settings",
    targets: [nav("/messages-api"), nav("/settings")]
  },
  {
    id: "search",
    group: "topBar",
    targets: ["top:search"],
    inMenu: false,
    side: "below"
  },
  {
    id: "account",
    group: "topBar",
    targets: ["top:user"],
    inMenu: false,
    side: "below"
  }
];

// The steps of one person, in order: the management and administration pages
// only exist for an administrator.
export const buildTourSteps = ({ isAdmin = false } = {}) =>
  STEPS.filter(step => !step.admin || isAdmin).map(step => ({
    side: "right",
    inMenu: true,
    route: null,
    ...step
  }));

// The page of the step is already the one on screen? An open conversation
// (`/tickets/<id>`) still counts as the Atendimentos page.
export const isOnTourRoute = (pathname, route) => {
  if (!route) return true;
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
};

const pointsOf = value =>
  Array.isArray(value) ? value.filter(item => typeof item === "string") : [];

// What the balloon of a step says.
export const tourStepContent = step => ({
  where: i18n.t(`featureTour.groups.${step.group}`),
  title: i18n.t(`featureTour.steps.${step.id}.title`),
  text: i18n.t(`featureTour.steps.${step.id}.text`),
  points: pointsOf(
    i18n.t(`featureTour.steps.${step.id}.points`, { returnObjects: true })
  )
});

// Was the offer answered (taken to the end, left midway or "not now")? With
// the storage blocked it is better to skip the offer than to repeat it on
// every visit.
export const featureTourAnswered = userId => {
  try {
    return localStorage.getItem(featureTourKey(userId)) !== null;
  } catch {
    return true;
  }
};

// `answer`: "done" (reached the end), "left" (left midway) or "later".
export const rememberFeatureTour = (userId, answer) => {
  try {
    localStorage.setItem(
      featureTourKey(userId),
      JSON.stringify({ answer, at: new Date().toISOString() })
    );
  } catch {
    /* The offer comes back on the next visit; nothing else to do. */
  }
};
