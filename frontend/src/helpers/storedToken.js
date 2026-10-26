// Zap Komunick: the auth token is saved as JSON in localStorage ("token"). Any
// other value on this origin (left by another app that used the same address and
// port, or a half-cleared storage) used to throw at JSON.parse and break the whole
// app; it is now discarded so the login screen shows up instead.
export function readStoredToken() {
  const raw = localStorage.getItem("token");

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    localStorage.removeItem("token");
    return null;
  }
}
