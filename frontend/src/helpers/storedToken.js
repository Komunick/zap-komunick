import { decodeToken } from "react-jwt";

// Zap Komunick: the auth token is saved as JSON in localStorage ("token"). Any
// other value on this origin (left by another app that used the same address and
// port, or a half-cleared storage) used to throw at JSON.parse, or later when
// decoding it, and break the whole app; it is now discarded so the login screen
// shows up instead.
export function readStoredToken() {
  const raw = localStorage.getItem("token");

  if (!raw) {
    return null;
  }

  try {
    const token = JSON.parse(raw);

    // only a string that decodes as a JWT with a user and a company is a token
    if (typeof token === "string") {
      const decoded = decodeToken(token);

      if (decoded && decoded.userId !== undefined) {
        return token;
      }
    }
  } catch (e) {
    // not JSON: falls through and is discarded
  }

  localStorage.removeItem("token");
  return null;
}
