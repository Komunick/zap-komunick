import React, { useEffect, useState } from "react";

import LoggedInLayout from "../layout";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import Route from "./Route";
import LazyRouteContent, { lazyRoute } from "./LazyRouteContent";

const Dashboard = lazyRoute(() => import("../pages/Dashboard"));
const TicketResponsiveContainer = lazyRoute(
  () => import("../pages/TicketResponsiveContainer")
);
const Connections = lazyRoute(() => import("../pages/Connections"));
const SettingsCustom = lazyRoute(() => import("../pages/SettingsCustom"));
const Financeiro = lazyRoute(() => import("../pages/Financeiro"));
const Users = lazyRoute(() => import("../pages/Users"));
const Contacts = lazyRoute(() => import("../pages/Contacts"));
const Queues = lazyRoute(() => import("../pages/Queues"));
const Tags = lazyRoute(() => import("../pages/Tags"));
const MessagesAPI = lazyRoute(() => import("../pages/MessagesAPI"));
const Helps = lazyRoute(() => import("../pages/Helps"));
const ContactLists = lazyRoute(() => import("../pages/ContactLists"));
const ContactListItems = lazyRoute(() => import("../pages/ContactListItems"));
const QuickMessages = lazyRoute(() => import("../pages/QuickMessages"));
const Schedules = lazyRoute(() => import("../pages/Schedules"));
const Campaigns = lazyRoute(() => import("../pages/Campaigns"));
const CampaignsConfig = lazyRoute(() => import("../pages/CampaignsConfig"));
const CampaignReport = lazyRoute(() => import("../pages/CampaignReport"));
const Annoucements = lazyRoute(() => import("../pages/Annoucements"));
const Chat = lazyRoute(() => import("../pages/Chat"));
const ToDoList = lazyRoute(() => import("../pages/ToDoList"));
const Subscription = lazyRoute(() => import("../pages/Subscription"));
const Kanban = lazyRoute(() => import("../pages/Kanban"));
const Sla = lazyRoute(() => import("../pages/Sla"));
const OnlineUsers = lazyRoute(() => import("../pages/OnlineUsers"));
const Metrics = lazyRoute(() => import("../pages/Metrics"));
const CloseReasons = lazyRoute(() => import("../pages/CloseReasons"));
const AccountSecurity = lazyRoute(() => import("../pages/AccountSecurity"));
const IpAllowlist = lazyRoute(() => import("../pages/IpAllowlist"));
const AuditLogs = lazyRoute(() => import("../pages/AuditLogs"));

const PrivateRoutes = () => {
  const [showCampaigns, setShowCampaigns] = useState(false);

  useEffect(() => {
    const cshow = localStorage.getItem("cshow");
    if (cshow !== undefined) {
      setShowCampaigns(true);
    }
  }, []);

  return (
    <WhatsAppsProvider>
      <LoggedInLayout>
        <LazyRouteContent>
          <Route exact path="/" component={Dashboard} isPrivate adminOnly />
          <Route
            exact
            path="/tickets/:ticketId?"
            component={TicketResponsiveContainer}
            isPrivate
          />
          <Route exact path="/connections" component={Connections} isPrivate />
          <Route
            exact
            path="/quick-messages"
            component={QuickMessages}
            isPrivate
          />
          <Route exact path="/schedules" component={Schedules} isPrivate />
          <Route exact path="/todolist" component={ToDoList} isPrivate />
          <Route exact path="/kanban" component={Kanban} isPrivate />
          <Route exact path="/sla" component={Sla} isPrivate />
          <Route exact path="/metrics" component={Metrics} isPrivate />
          <Route
            exact
            path="/account-security"
            component={AccountSecurity}
            isPrivate
          />
          <Route exact path="/ip-allowlist" component={IpAllowlist} isPrivate />
          <Route exact path="/audit-logs" component={AuditLogs} isPrivate />
          <Route exact path="/users-online" component={OnlineUsers} isPrivate />
          <Route
            exact
            path="/close-reasons"
            component={CloseReasons}
            isPrivate
          />
          <Route exact path="/tags" component={Tags} isPrivate />
          <Route exact path="/contacts" component={Contacts} isPrivate />
          <Route exact path="/helps" component={Helps} isPrivate />
          <Route exact path="/users" component={Users} isPrivate />
          <Route exact path="/messages-api" component={MessagesAPI} isPrivate />
          <Route exact path="/settings" component={SettingsCustom} isPrivate />
          <Route exact path="/financeiro" component={Financeiro} isPrivate />
          <Route exact path="/queues" component={Queues} isPrivate />
          <Route
            exact
            path="/announcements"
            component={Annoucements}
            isPrivate
          />
          <Route
            exact
            path="/subscription"
            component={Subscription}
            isPrivate
          />

          <Route exact path="/chats/:id?" component={Chat} isPrivate />
          {showCampaigns && (
            <>
              <Route
                exact
                path="/contact-lists"
                component={ContactLists}
                isPrivate
              />
              <Route
                exact
                path="/contact-lists/:contactListId/contacts"
                component={ContactListItems}
                isPrivate
              />
              <Route exact path="/campaigns" component={Campaigns} isPrivate />
              <Route
                exact
                path="/campaign/:campaignId/report"
                component={CampaignReport}
                isPrivate
              />
              <Route
                exact
                path="/campaigns-config"
                component={CampaignsConfig}
                isPrivate
              />
            </>
          )}
        </LazyRouteContent>
      </LoggedInLayout>
    </WhatsAppsProvider>
  );
};

export default PrivateRoutes;
