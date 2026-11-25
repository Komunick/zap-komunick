import React from "react";
import "@testing-library/jest-dom";
import {
  act,
  configure,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { MemoryRouter, Router, useLocation } from "react-router-dom";
import { createMemoryHistory } from "history";
import FeatureTour from ".";
import {
  FEATURE_TOUR_EVENT,
  buildTourSteps,
  featureTourKey
} from "../../helpers/featureTour";

jest.mock("../../translate/i18n", () => ({
  i18n: {
    t: (key, options) => {
      if (options?.returnObjects) return [`${key}.0`, `${key}.1`];
      if (key === "featureTour.stepOf") {
        return `passo ${options.n} de ${options.total}`;
      }
      if (key === "featureTour.stepShort") {
        return `curto ${options.n}/${options.total}`;
      }
      if (key === "featureTour.offerText") return `tour de ${options.total}`;
      return key;
    }
  }
}));

configure({ asyncUtilTimeout: 4000 });
jest.setTimeout(30000);

const agent = { id: 7, profile: "user" };
const admin = { id: 9, profile: "admin" };
const agentSteps = buildTourSteps();
const adminSteps = buildTourSteps({ isAdmin: true });

// The rectangles the marked elements "have" in this test (jsdom lays nothing
// out: every element is 0 x 0 unless told otherwise).
let rects = {};
const realRect = Element.prototype.getBoundingClientRect;

const Where = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
};

const renderTour = ({
  user = agent,
  canOffer = true,
  at = "/contacts?x=1",
  onActiveChange = jest.fn(),
  marks = []
} = {}) => {
  const view = render(
    <MemoryRouter initialEntries={[at]}>
      <Where />
      {marks.map(mark => (
        <span
          key={mark}
          data-tour={mark}
          data-tour-side={mark === "nav:more" ? "below" : undefined}
        />
      ))}
      <FeatureTour
        user={user}
        canOffer={canOffer}
        onActiveChange={onActiveChange}
      />
    </MemoryRouter>
  );
  return { ...view, onActiveChange };
};

const answerOf = userId => {
  const stored = localStorage.getItem(featureTourKey(userId));
  return stored === null ? null : JSON.parse(stored).answer;
};

const askForTour = () =>
  act(() => {
    window.dispatchEvent(new CustomEvent(FEATURE_TOUR_EVENT));
  });

const tour = () => screen.getByRole("dialog", { name: "featureTour.title" });
const click = name => fireEvent.click(screen.getByRole("button", { name }));
const title = id => `featureTour.steps.${id}.title`;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function mockedRect() {
    const mark = this.getAttribute?.("data-tour");
    const rect = mark && rects[mark];
    if (!rect) return realRect.call(this);
    return {
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top
    };
  };
  Element.prototype.scrollIntoView = jest.fn();
});

afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
  delete Element.prototype.scrollIntoView;
});

beforeEach(() => {
  localStorage.clear();
  rects = {};
  Element.prototype.scrollIntoView.mockClear();
});

describe("the offer", () => {
  it("is made once to a user who never answered it", () => {
    const { unmount } = renderTour();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "featureTour.offerTitle"
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      `tour de ${agentSteps.length}`
    );

    click("featureTour.notNow");
    expect(answerOf(7)).toBe("later");
    unmount();

    renderTour();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("waits while another notice is on screen", () => {
    const { rerender } = render(
      <MemoryRouter>
        <FeatureTour user={agent} canOffer={false} />
      </MemoryRouter>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <FeatureTour user={agent} canOffer />
      </MemoryRouter>
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "featureTour.offerTitle"
    );
  });

  it("is not made before the user is known", () => {
    renderTour({ user: {} });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a different answer for each user", () => {
    localStorage.setItem(featureTourKey(7), JSON.stringify({ answer: "done" }));
    renderTour({ user: admin });
    expect(screen.getByRole("dialog")).toHaveTextContent(
      `tour de ${adminSteps.length}`
    );
  });
});

describe("answering the invitation", () => {
  it("does not take Esc or a click outside as an answer", () => {
    const { unmount } = renderTour();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(answerOf(7)).toBeNull();
    unmount();

    // so it is offered again the next time the page is loaded
    renderTour();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "featureTour.offerTitle"
    );
  });

  it("closes in this tab when it is answered in another one, writing nothing", async () => {
    renderTour();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // the other tab stored the answer: this one only hears about it
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: featureTourKey(7),
          newValue: JSON.stringify({ answer: "later" })
        })
      );
    });

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    // this tab's own storage was not touched by closing
    expect(answerOf(7)).toBeNull();
  });

  it("ignores what another tab stores for someone else, or a removal", async () => {
    renderTour();
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: featureTourKey(8), newValue: "{}" })
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: featureTourKey(7), newValue: null })
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: "layoutMode", newValue: "foco" })
      );
    });
    // a dialog that was told to close stays in the document while it fades
    // out: only after that time does "still there" mean "was not closed"
    await act(() => new Promise(resolve => setTimeout(resolve, 500)));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "featureTour.offerTitle"
    );
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("does not close a tour that is running when another tab answers", () => {
    renderTour();
    click("featureTour.start");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: featureTourKey(7),
          newValue: JSON.stringify({ answer: "later" })
        })
      );
    });
    expect(tour()).toHaveTextContent(title("tickets"));
  });

  it("counts a tour taken from the menu as the answer when the invitation was only closed", () => {
    const { unmount } = renderTour();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(answerOf(7)).toBeNull();

    // later, "Tour pelo sistema" in the menu, to the end
    askForTour();
    agentSteps.forEach((step, position) =>
      click(
        position === agentSteps.length - 1
          ? "featureTour.finish"
          : "featureTour.next"
      )
    );
    click("featureTour.conclude");
    expect(answerOf(7)).toBe("done");
    unmount();

    // whoever took the tour is not invited to it again
    renderTour();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("takes a request for the tour while the invitation is open as accepting it", () => {
    renderTour();
    askForTour();
    expect(tour()).toHaveTextContent(title("tickets"));
    click("featureTour.leave");
    // the answer of the first time is recorded, so it is not offered again
    expect(answerOf(7)).toBe("left");
  });

  it("ignores a request for the tour while the first tour is running", () => {
    renderTour();
    click("featureTour.start");
    click("featureTour.next");
    askForTour();
    // same step, and the tour still counts as the answer to the invitation
    expect(tour()).toHaveTextContent(title("ticketsList"));
    click("featureTour.leave");
    expect(answerOf(7)).toBe("left");
  });
});

describe("the tour", () => {
  it("walks every step, opening the page of each feature", () => {
    const { onActiveChange } = renderTour();
    click("featureTour.start");

    expect(onActiveChange).toHaveBeenLastCalledWith(true);
    let page = "/contacts?x=1";
    agentSteps.forEach((step, position) => {
      expect(screen.getByTestId("tour-pill")).toHaveTextContent(
        `passo ${position + 1} de ${agentSteps.length}`
      );
      expect(tour()).toHaveTextContent(title(step.id));
      expect(tour()).toHaveTextContent(`featureTour.steps.${step.id}.text`);
      expect(tour()).toHaveTextContent(`featureTour.steps.${step.id}.points.1`);
      expect(tour()).toHaveTextContent(`featureTour.groups.${step.group}`);
      // a step without a page of its own stays on the page of the one before
      page = step.route || page;
      expect(screen.getByTestId("where")).toHaveTextContent(page);
      click(
        position === agentSteps.length - 1
          ? "featureTour.finish"
          : "featureTour.next"
      );
    });

    // the final screen: nothing is stored before "Concluir"
    expect(tour()).toHaveTextContent("featureTour.endTitle");
    expect(screen.queryByTestId("tour-balloon")).not.toBeInTheDocument();
    expect(answerOf(7)).toBeNull();

    click("featureTour.conclude");
    expect(answerOf(7)).toBe("done");
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // back where the person was, query string included
    expect(screen.getByTestId("where")).toHaveTextContent("/contacts?x=1");
  });

  it("shows an administrator the management and administration steps too", () => {
    renderTour({ user: admin });
    click("featureTour.start");
    expect(screen.getByTestId("tour-pill")).toHaveTextContent(
      `passo 1 de ${adminSteps.length}`
    );
    const connections = adminSteps.findIndex(step => step.id === "connections");
    for (let i = 0; i < connections; i += 1) click("featureTour.next");
    expect(tour()).toHaveTextContent(title("connections"));
    expect(screen.getByTestId("where")).toHaveTextContent("/connections");
  });

  it("goes back one step, and the first step has no way back", () => {
    renderTour();
    click("featureTour.start");
    expect(
      screen.queryByRole("button", { name: "featureTour.back" })
    ).not.toBeInTheDocument();

    click("featureTour.next");
    click("featureTour.next");
    click("featureTour.next");
    expect(tour()).toHaveTextContent(title("kanban"));
    expect(screen.getByTestId("where")).toHaveTextContent("/kanban");

    click("featureTour.back");
    expect(tour()).toHaveTextContent(title("ticketsChat"));
    expect(screen.getByTestId("where")).toHaveTextContent("/tickets");
  });

  it("walks with the arrow keys and leaves with Esc", () => {
    const { onActiveChange } = renderTour();
    click("featureTour.start");

    fireEvent.keyDown(tour(), { key: "ArrowRight" });
    expect(tour()).toHaveTextContent(title("ticketsList"));
    fireEvent.keyDown(tour(), { key: "ArrowLeft" });
    expect(tour()).toHaveTextContent(title("tickets"));
    fireEvent.keyDown(tour(), { key: "ArrowLeft" });
    expect(tour()).toHaveTextContent(title("tickets"));

    fireEvent.keyDown(tour(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(answerOf(7)).toBe("left");
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId("where")).toHaveTextContent("/contacts?x=1");
  });

  it('always has "Sair do tour", which never counts as concluding', () => {
    renderTour();
    click("featureTour.start");
    click("featureTour.next");
    click("featureTour.leave");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(answerOf(7)).toBe("left");
  });

  it("repeats from the first step on the final screen", () => {
    renderTour();
    click("featureTour.start");
    agentSteps.forEach((step, position) =>
      click(
        position === agentSteps.length - 1
          ? "featureTour.finish"
          : "featureTour.next"
      )
    );
    click("featureTour.repeat");
    expect(screen.getByTestId("tour-pill")).toHaveTextContent(
      `passo 1 de ${agentSteps.length}`
    );
    expect(tour()).toHaveTextContent(title("tickets"));
    expect(answerOf(7)).toBeNull();
  });

  it("opens from the user menu without touching the stored answer", () => {
    localStorage.setItem(
      featureTourKey(7),
      JSON.stringify({ answer: "later" })
    );
    const { onActiveChange } = renderTour({ at: "/kanban" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    askForTour();
    expect(tour()).toHaveTextContent(title("tickets"));
    expect(onActiveChange).toHaveBeenLastCalledWith(true);

    click("featureTour.leave");
    expect(answerOf(7)).toBe("later");
    expect(screen.getByTestId("where")).toHaveTextContent("/kanban");
  });

  it("keeps an open conversation open on the Atendimentos steps", () => {
    localStorage.setItem(featureTourKey(7), JSON.stringify({ answer: "done" }));
    renderTour({ at: "/tickets/abc-123" });
    askForTour();
    expect(screen.getByTestId("where")).toHaveTextContent("/tickets/abc-123");
    click("featureTour.next");
    click("featureTour.next");
    expect(screen.getByTestId("where")).toHaveTextContent("/tickets/abc-123");
  });
});

describe("what guides the eye", () => {
  it("lights the menu item of the step and hangs the balloon on it", async () => {
    rects = { "nav:/tickets": { left: 10, top: 120, width: 220, height: 48 } };
    renderTour({ marks: ["nav:/tickets"] });
    click("featureTour.start");

    const spotlight = await screen.findByTestId("tour-spotlight");
    expect(spotlight).toHaveStyle({
      left: "4px",
      top: "114px",
      width: "232px",
      height: "60px",
      opacity: "1"
    });
    await waitFor(() =>
      expect(screen.getByTestId("tour-balloon")).toHaveAttribute(
        "data-side",
        "right"
      )
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("lights one area around the several items of a step", async () => {
    rects = {
      "tickets:tabs": { left: 80, top: 100, width: 380, height: 48 },
      "tickets:actions": { left: 80, top: 148, width: 380, height: 52 }
    };
    renderTour({ marks: ["tickets:tabs", "tickets:actions"] });
    click("featureTour.start");
    click("featureTour.next");

    await waitFor(() =>
      expect(screen.getByTestId("tour-spotlight")).toHaveStyle({
        left: "74px",
        top: "94px",
        width: "392px",
        height: "112px"
      })
    );
  });

  it('points at the "More" tab when the page lives inside it', async () => {
    rects = { "nav:more": { left: 700, top: 56, width: 90, height: 44 } };
    renderTour({ user: admin, marks: ["nav:more", "nav:/connections"] });
    click("featureTour.start");
    const connections = adminSteps.findIndex(step => step.id === "connections");
    for (let i = 0; i < connections; i += 1) click("featureTour.next");

    await waitFor(() =>
      expect(screen.getByTestId("tour-spotlight")).toHaveStyle({
        left: "694px",
        top: "50px",
        opacity: "1"
      })
    );
    expect(screen.getByTestId("tour-balloon")).toHaveAttribute(
      "data-side",
      "below"
    );
  });

  it("explains in a card when there is nothing on screen to point at", async () => {
    renderTour();
    click("featureTour.start");

    // while the target may still show up, the balloon stays out of sight
    expect(screen.getByTestId("tour-balloon")).toHaveAttribute("data-side", "");
    await waitFor(() =>
      expect(screen.getByTestId("tour-balloon")).toHaveAttribute(
        "data-side",
        "card"
      )
    );
    expect(screen.queryByTestId("tour-spotlight")).not.toBeInTheDocument();
    expect(tour()).toHaveTextContent(title("tickets"));
  });

  it('does not use the "More" tab for a step about a part of a page', async () => {
    rects = { "nav:more": { left: 700, top: 56, width: 90, height: 44 } };
    renderTour({ marks: ["nav:more"] });
    click("featureTour.start");
    click("featureTour.next");
    expect(tour()).toHaveTextContent(title("ticketsList"));

    await waitFor(() =>
      expect(screen.getByTestId("tour-balloon")).toHaveAttribute(
        "data-side",
        "card"
      )
    );
  });
});

describe("the app behind the tour", () => {
  it("stands still while the tour is open and comes back after it", () => {
    const appRoot = document.createElement("div");
    appRoot.id = "root";
    document.body.appendChild(appRoot);
    render(
      <MemoryRouter>
        <FeatureTour user={agent} />
      </MemoryRouter>,
      { container: appRoot }
    );

    click("featureTour.start");
    expect(appRoot).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");
    // the tour itself lives outside the inert app
    expect(appRoot).not.toContainElement(tour());

    click("featureTour.leave");
    expect(appRoot).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");
    appRoot.remove();
  });
});

describe("the keyboard", () => {
  it("keeps Tab going round the buttons of the tour", () => {
    renderTour();
    click("featureTour.start");
    click("featureTour.next");
    const leave = screen.getByRole("button", { name: "featureTour.leave" });
    const back = screen.getByRole("button", { name: "featureTour.back" });
    const next = screen.getByRole("button", { name: "featureTour.next" });

    // from the last button, Tab goes back to the first instead of leaving
    next.focus();
    fireEvent.keyDown(next, { key: "Tab" });
    expect(leave).toHaveFocus();

    // and Shift+Tab on the first goes to the last
    fireEvent.keyDown(leave, { key: "Tab", shiftKey: true });
    expect(next).toHaveFocus();

    // in the middle the browser does its own thing
    back.focus();
    expect(fireEvent.keyDown(back, { key: "Tab" })).toBe(true);
    expect(back).toHaveFocus();
  });

  it("brings the focus back when Tab is pressed outside the tour", () => {
    renderTour();
    click("featureTour.start");
    document.body.focus();
    fireEvent.keyDown(document.body, { key: "Tab" });
    expect(
      screen.getByRole("button", { name: "featureTour.leave" })
    ).toHaveFocus();
  });

  it("obeys the keys with the focus outside the tour", () => {
    renderTour();
    click("featureTour.start");

    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(tour()).toHaveTextContent(title("ticketsList"));

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(answerOf(7)).toBe("left");
  });

  it("does not walk two steps for one key pressed inside the tour", () => {
    renderTour();
    click("featureTour.start");
    fireEvent.keyDown(tour(), { key: "ArrowRight" });
    expect(screen.getByTestId("tour-pill")).toHaveTextContent(
      `passo 2 de ${agentSteps.length}`
    );
  });
});

describe("the shortcuts of the app", () => {
  it("does not let Ctrl K open the quick search behind the tour", () => {
    const onWindowKey = jest.fn();
    window.addEventListener("keydown", onWindowKey);
    renderTour();

    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    expect(onWindowKey).toHaveBeenCalledTimes(1);

    click("featureTour.start");
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    fireEvent.keyDown(tour(), { key: "K", metaKey: true });
    expect(onWindowKey).toHaveBeenCalledTimes(1);

    // once the tour is closed the shortcut is back
    click("featureTour.leave");
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    expect(onWindowKey).toHaveBeenCalledTimes(2);
    window.removeEventListener("keydown", onWindowKey);
  });
});

describe('"Sair do tour"', () => {
  it("moves to the other corner when the step points at its corner", async () => {
    rects = {
      "top:user": { left: 870, top: 4, width: 150, height: 48 },
      "top:search": { left: 290, top: 4, width: 400, height: 48 }
    };
    renderTour({ marks: ["top:user", "top:search"] });
    click("featureTour.start");
    const search = agentSteps.findIndex(step => step.id === "search");
    for (let i = 0; i < search; i += 1) click("featureTour.next");

    await screen.findByTestId("tour-spotlight");
    const leave = screen.getByRole("button", { name: "featureTour.leave" });
    const corner = leave.className;

    click("featureTour.next");
    expect(tour()).toHaveTextContent(title("account"));
    await waitFor(() => expect(leave.className).not.toBe(corner));

    click("featureTour.back");
    await waitFor(() => expect(leave.className).toBe(corner));
  });
});

describe("what the tour leaves behind", () => {
  it("does not fill the browser history with the pages of the tour", () => {
    localStorage.setItem(featureTourKey(7), JSON.stringify({ answer: "done" }));
    const history = createMemoryHistory({
      initialEntries: ["/kanban", "/contacts?x=1"],
      initialIndex: 1
    });
    render(
      <Router history={history}>
        <FeatureTour user={agent} />
      </Router>
    );
    const before = history.length;

    askForTour();
    agentSteps.forEach((step, position) =>
      click(
        position === agentSteps.length - 1
          ? "featureTour.finish"
          : "featureTour.next"
      )
    );
    click("featureTour.conclude");

    expect(history.length).toBe(before);
    expect(`${history.location.pathname}${history.location.search}`).toBe(
      "/contacts?x=1"
    );
    // Back goes to where the person was before, not through the tour
    act(() => history.goBack());
    expect(history.location.pathname).toBe("/kanban");
  });

  it("ends where the person went when they leave the tour by the Back button", () => {
    localStorage.setItem(featureTourKey(7), JSON.stringify({ answer: "done" }));
    const history = createMemoryHistory({
      initialEntries: ["/kanban", "/contacts"],
      initialIndex: 1
    });
    const onActiveChange = jest.fn();
    render(
      <Router history={history}>
        <FeatureTour user={agent} onActiveChange={onActiveChange} />
      </Router>
    );
    askForTour();
    click("featureTour.next");
    expect(history.location.pathname).toBe("/tickets");

    // the Back button: a move the tour did not make
    act(() => history.goBack());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
    // the person stays where the button took them, and that page of their
    // history was not replaced by the tour
    expect(history.location.pathname).toBe("/kanban");
    expect(history.length).toBe(2);
    expect(history.entries[0].pathname).toBe("/kanban");
  });

  it("keeps running through the moves it makes itself", () => {
    localStorage.setItem(featureTourKey(7), JSON.stringify({ answer: "done" }));
    const history = createMemoryHistory({ initialEntries: ["/contacts"] });
    render(
      <Router history={history}>
        <FeatureTour user={agent} />
      </Router>
    );
    askForTour();
    for (let i = 0; i < 5; i += 1) click("featureTour.next");
    expect(tour()).toHaveTextContent(title("contacts"));
    expect(history.location.pathname).toBe("/contacts");
    click("featureTour.back");
    expect(tour()).toHaveTextContent(title("quickMessages"));
    expect(history.location.pathname).toBe("/quick-messages");
  });

  it("keeps the script it began with when the profile changes in the middle", () => {
    localStorage.setItem(featureTourKey(9), JSON.stringify({ answer: "done" }));
    const { rerender } = render(
      <MemoryRouter>
        <FeatureTour user={admin} />
      </MemoryRouter>
    );
    askForTour();
    const users = adminSteps.findIndex(step => step.id === "users");
    for (let i = 0; i < users; i += 1) click("featureTour.next");
    expect(tour()).toHaveTextContent(title("users"));

    // the administrator becomes a plain user while the tour is on screen
    rerender(
      <MemoryRouter>
        <FeatureTour user={{ ...admin, profile: "user" }} />
      </MemoryRouter>
    );
    expect(tour()).toHaveTextContent(title("users"));
    expect(screen.getByTestId("tour-pill")).toHaveTextContent(
      `passo ${users + 1} de ${adminSteps.length}`
    );
    expect(tour()).not.toHaveTextContent("featureTour.endTitle");
  });
});

describe("the size of the window", () => {
  const realHeight = window.innerHeight;
  const realWidth = window.innerWidth;
  const resizeTo = (width, height) => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: height
    });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
  };
  afterEach(() => resizeTo(realWidth, realHeight));

  it("moves the card when the window changes and the target does not", async () => {
    resizeTo(400, 800);
    renderTour();
    click("featureTour.start");
    const balloon = screen.getByTestId("tour-balloon");
    await waitFor(() => expect(balloon).toHaveAttribute("data-side", "card"));
    expect(balloon).toHaveStyle({ top: "780px" });

    // the phone is turned: the card follows the new height
    resizeTo(800, 400);
    await waitFor(() => expect(balloon).toHaveStyle({ top: "380px" }));
  });
});
