import { i18n } from "../translate/i18n";

// Zap Komunick: pages reachable from the top tabs (Foco layout) and from the
// command palette (Ctrl K). The rail/sidebar keeps using MainListItems, which
// owns the permission rules and the badges.
export const buildNavItems = isAdmin => {
  const t = key => i18n.t(`mainDrawer.listItems.${key}`);

  const main = [
    { id: "tickets", to: "/tickets", label: t("tickets") },
    { id: "kanban", to: "/kanban", label: t("kanban") },
    { id: "contacts", to: "/contacts", label: t("contacts") },
    { id: "schedules", to: "/schedules", label: t("schedules") },
    ...(isAdmin
      ? [
          { id: "sla", to: "/sla", label: t("sla") },
          { id: "metrics", to: "/metrics", label: t("metrics") },
          { id: "onlineUsers", to: "/users-online", label: t("onlineUsers") }
        ]
      : []),
    { id: "quickMessages", to: "/quick-messages", label: t("quickMessages") },
    { id: "tags", to: "/tags", label: t("tags") },
    { id: "chats", to: "/chats", label: t("chats") }
  ];

  const more = [
    ...(isAdmin
      ? [
          { id: "dashboard", to: "/", label: t("dashboard") },
          { id: "connections", to: "/connections", label: t("connections") },
          { id: "queues", to: "/queues", label: t("queues") },
          { id: "users", to: "/users", label: t("users") },
          {
            id: "announcements",
            to: "/announcements",
            label: t("annoucements")
          },
          {
            id: "closeReasons",
            to: "/close-reasons",
            label: t("closeReasons")
          },
          { id: "messagesAPI", to: "/messages-api", label: t("messagesAPI") },
          { id: "settings", to: "/settings", label: t("settings") }
        ]
      : []),
    { id: "tasks", to: "/todolist", label: t("tasks") },
    { id: "helps", to: "/helps", label: t("helps") }
  ];

  return { main, more };
};

export const isActivePath = (pathname, to) =>
  to === "/" ? pathname === "/" : pathname.startsWith(to);
