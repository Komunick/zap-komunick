import React, { useContext } from "react";
import { Route as RouterRoute, Redirect } from "react-router-dom";

import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { getSessionHome } from "../helpers/sessionHome";

const Route = ({
  component: Component,
  isPrivate = false,
  adminOnly = false,
  render,
  children,
  ...rest
}) => {
  const { isAuth, loading, user } = useContext(AuthContext);

  // Zap Komunick: private routes also live outside Switch. Guard only a match,
  // and never mount its page before the session/profile has been resolved.
  return (
    <RouterRoute
      {...rest}
      render={routeProps => {
        if (loading || (isAuth && !user?.profile)) {
          return <BackdropLoading />;
        }

        if (!isAuth && isPrivate) {
          return (
            <Redirect
              to={{ pathname: "/login", state: { from: routeProps.location } }}
            />
          );
        }

        if (isAuth && !isPrivate) {
          return (
            <Redirect
              to={{
                pathname: getSessionHome(user),
                state: { from: routeProps.location }
              }}
            />
          );
        }

        if (isAuth && adminOnly && user.profile !== "admin") {
          return <Redirect to="/tickets" />;
        }

        if (children) {
          return typeof children === "function"
            ? children(routeProps)
            : children;
        }
        if (Component) return <Component {...routeProps} />;
        return render ? render(routeProps) : null;
      }}
    />
  );
};

export default Route;
