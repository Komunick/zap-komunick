// Zap Komunick: login and public-route redirects share the session destination.
export const getSessionHome = user =>
  user?.profile === "admin" && !user.hideAdminUI ? "/" : "/tickets";
