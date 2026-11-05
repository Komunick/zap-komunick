import React from "react";
import { BrowserRouter, Switch } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import Login from "../pages/Login";
import { AuthProvider } from "../context/Auth/AuthContext";
import { TicketsContextProvider } from "../context/Tickets/TicketsContext";
import Route from "./Route";
import LazyRouteContent, { lazyRoute } from "./LazyRouteContent";

const Signup = lazyRoute(() => import("../pages/Signup"));
const PrivateRoutes = lazyRoute(() => import("./PrivateRoutes"));

const Routes = () => (
  <BrowserRouter>
    <AuthProvider>
      <TicketsContextProvider>
        <LazyRouteContent fullPage>
          <Switch>
            <Route exact path="/login" component={Login} />
            <Route exact path="/signup" component={Signup} />
            <Route isPrivate component={PrivateRoutes} />
          </Switch>
        </LazyRouteContent>
        <ToastContainer autoClose={3000} />
      </TicketsContextProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default Routes;
