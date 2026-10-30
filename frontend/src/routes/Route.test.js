import React, { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Switch, useLocation } from "react-router-dom";

import Route from "./Route";
import { AuthContext } from "../context/Auth/AuthContext";

jest.mock("../context/Auth/AuthContext", () => ({
  AuthContext: require("react").createContext({})
}));
jest.mock("../components/BackdropLoading", () => () => (
  <div role="status">Restoring session</div>
));

const dashboardRequest = jest.fn();
const dashboardUnmount = jest.fn();
const locations = [];

const Dashboard = () => {
  useEffect(() => {
    ["tickets", "users", "status"].forEach(resource =>
      dashboardRequest(`/dashboard/${resource}`)
    );
    return dashboardUnmount;
  }, []);
  return <div>Administrative dashboard</div>;
};
const Location = () => {
  const location = useLocation();
  locations.push(location);
  return <div data-testid="location">{location.pathname}</div>;
};

const regularUser = { id: 1, profile: "user" };
const admin = { id: 2, profile: "admin" };
const ready = user => ({ isAuth: true, loading: false, user });
const Layout = ({ children }) => <div>{children}</div>;

// Match the application's public Switch and its sibling private routes inside
// a layout: an unmatched dashboard route must not redirect another page.
const App = ({ session, entry = "/login", extraRoute }) => (
  <AuthContext.Provider value={session}>
    <MemoryRouter initialEntries={[entry]}>
      <Location />
      <Switch>
        <Route exact path="/login" render={() => <div>Login form</div>} />
        <Layout>
          <Route exact path="/" component={Dashboard} isPrivate adminOnly />
          <Route
            exact
            path="/tickets"
            render={() => <div>Tickets page</div>}
            isPrivate
          />
          <Route
            path="/chats"
            render={() => <div>Internal chat</div>}
            isPrivate
          />
          {extraRoute}
        </Layout>
      </Switch>
    </MemoryRouter>
  </AuthContext.Provider>
);

beforeEach(() => {
  dashboardRequest.mockClear();
  dashboardUnmount.mockClear();
  locations.length = 0;
});

test.each([
  ["regular user", regularUser],
  ["administrator with hidden admin UI", { ...admin, hideAdminUI: true }]
])("authenticated login sends %s directly to tickets", (_, user) => {
  render(<App session={ready(user)} />);
  expect(screen.getByTestId("location").textContent).toBe("/tickets");
  expect(screen.getByText("Tickets page")).toBeTruthy();
  expect(dashboardRequest).not.toHaveBeenCalled();
});

test("authenticated administrator reaches the working dashboard", () => {
  render(<App session={ready(admin)} />);
  expect(screen.getByTestId("location").textContent).toBe("/");
  expect(screen.getByText("Administrative dashboard")).toBeTruthy();
  expect(dashboardRequest.mock.calls.map(([url]) => url)).toEqual([
    "/dashboard/tickets",
    "/dashboard/users",
    "/dashboard/status"
  ]);
});

test.each([regularUser, { id: 3, profile: "unknown" }])(
  "direct root rejects a non-administrative profile before mounting",
  user => {
    render(<App session={ready(user)} entry="/" />);
    expect(screen.getByTestId("location").textContent).toBe("/tickets");
    expect(dashboardRequest).not.toHaveBeenCalled();
  }
);

test("hideAdminUI preserves an administrator's direct dashboard access", () => {
  render(<App session={ready({ ...admin, hideAdminUI: true })} entry="/" />);
  expect(screen.getByText("Administrative dashboard")).toBeTruthy();
  expect(dashboardRequest).toHaveBeenCalledTimes(3);
});

test.each([
  ["/", { isAuth: true, loading: true, user: admin }],
  ["/tickets", { isAuth: true, loading: true, user: regularUser }],
  ["/login", { isAuth: false, loading: true, user: {} }],
  ["/", { isAuth: true, loading: false, user: {} }]
])(
  "session resolution blocks page mounting and redirects at %s",
  (entry, session) => {
    render(<App session={session} entry={entry} />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe(entry);
    expect(screen.queryByText("Administrative dashboard")).toBeNull();
    expect(screen.queryByText("Tickets page")).toBeNull();
    expect(screen.queryByText("Login form")).toBeNull();
    expect(dashboardRequest).not.toHaveBeenCalled();
  }
);

test("restoration to a regular user never mounts the dashboard", () => {
  const { rerender } = render(
    <App session={{ isAuth: false, loading: true, user: {} }} entry="/" />
  );
  rerender(<App session={ready(regularUser)} entry="/" />);
  expect(screen.getByText("Tickets page")).toBeTruthy();
  expect(dashboardRequest).not.toHaveBeenCalled();
});

test("failed restoration ends loading and preserves the denied location", () => {
  const { rerender } = render(
    <App
      session={{ isAuth: true, loading: true, user: {} }}
      entry="/chats?fixture=1"
    />
  );
  rerender(
    <App
      session={{ isAuth: false, loading: false, user: {} }}
      entry="/chats?fixture=1"
    />
  );
  expect(screen.getByText("Login form")).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
  expect(locations[locations.length - 1].state.from).toMatchObject({
    pathname: "/chats",
    search: "?fixture=1"
  });
  expect(dashboardRequest).not.toHaveBeenCalled();
});

test("a profile update removes a mounted administrative dashboard", () => {
  const { rerender } = render(<App session={ready(admin)} entry="/" />);
  expect(dashboardRequest).toHaveBeenCalledTimes(3);
  rerender(<App session={ready(regularUser)} entry="/" />);
  expect(screen.getByText("Tickets page")).toBeTruthy();
  expect(screen.queryByText("Administrative dashboard")).toBeNull();
  expect(dashboardUnmount).toHaveBeenCalledTimes(1);
  expect(dashboardRequest).toHaveBeenCalledTimes(3);
});

test("an unmatched administrative route does not redirect internal chat", () => {
  render(<App session={ready(regularUser)} entry="/chats" />);
  expect(screen.getByTestId("location").textContent).toBe("/chats");
  expect(screen.getByText("Internal chat")).toBeTruthy();
  expect(dashboardRequest).not.toHaveBeenCalled();
});

test.each(["render", "children"])(
  "%s receives route props only after the session resolves",
  mode => {
    const content = jest.fn(({ match }) => <div>Record {match.params.id}</div>);
    const extraRoute = (
      <Route path="/records/:id" isPrivate {...{ [mode]: content }} />
    );
    const { rerender } = render(
      <App
        session={{ ...ready(regularUser), loading: true }}
        entry="/records/42"
        extraRoute={extraRoute}
      />
    );
    expect(content).not.toHaveBeenCalled();
    rerender(
      <App
        session={ready(regularUser)}
        entry="/records/42"
        extraRoute={extraRoute}
      />
    );
    expect(screen.getByText("Record 42")).toBeTruthy();
    expect(content.mock.calls[0][0].location.pathname).toBe("/records/42");
    expect(typeof content.mock.calls[0][0].history.push).toBe("function");
  }
);
