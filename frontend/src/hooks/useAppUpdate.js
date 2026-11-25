import { useContext, useEffect, useState } from "react";
import { SocketContext } from "../context/Socket/SocketContext";
import {
  UPDATE_AVAILABLE_EVENT,
  checkPublishedVersion,
  runningMainScript
} from "../helpers/appVersion";

// Zap Komunick: tells when a newer frontend than the one running was published
// (docs/PRD.md, RF-032), so whoever keeps the SuperChat open all day is told.
//
// WHEN IT LOOKS. A publication replaces the containers, so every open page
// loses its connection and gets it back: that reconnection is the main cue.
// The backend comes back before the new frontend is being served, so the page
// looks a little after the reconnection and once more a few minutes later.
// Coming back to the tab, coming back online and a slow clock cover the pages
// that missed the cue, and so does a layout that mounts on a page loaded long
// ago (logging out and in again does not load the page). A route that could
// not load one of its files MAY be asking for a file of the previous
// publication, or the network may just have blinked: it makes the page look,
// it is not taken as proof.
//
// It only ever answers "there is a new version". It never reloads the page:
// that is the person's click (components/UpdateNotice).

export const AFTER_RECONNECT_MS = [10 * 1000, 3 * 60 * 1000];
export const RETURN_GAP_MS = 5 * 60 * 1000;
export const SLOW_CLOCK_MS = 15 * 60 * 1000;

const tabVisible = () => document.visibilityState !== "hidden";

const useAppUpdate = () => {
  const socketManager = useContext(SocketContext);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    let found = false;
    let looking = false;
    let lastLook = 0;
    const timers = new Set();
    const cleanups = [];

    const stopLooking = () => {
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
    };

    const markFound = () => {
      if (!active || found) return;
      found = true;
      stopLooking();
      setAvailable(true);
    };

    const look = async () => {
      if (!active || found || looking) return;
      looking = true;
      const answer = await checkPublishedVersion();
      looking = false;
      // A look that could not tell (offline) does not count: the next cue,
      // like the connection coming back, looks again at once.
      if (answer !== "unknown") lastLook = Date.now();
      if (answer === "newer") markFound();
    };

    const lookIn = ms => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        look();
      }, ms);
      timers.add(timer);
    };

    // A route that could not load one of its files: where the page can
    // compare, it looks (a network blip must not light the notice for good);
    // where it cannot, the missing file is all there is to go by.
    const canCompare = !!runningMainScript();
    const onMissingFile = () => (canCompare ? look() : markFound());
    window.addEventListener(UPDATE_AVAILABLE_EVENT, onMissingFile);
    cleanups.push(() =>
      window.removeEventListener(UPDATE_AVAILABLE_EVENT, onMissingFile)
    );

    // While developing the script has no hash: there is nothing to compare.
    if (canCompare) {
      // The layout mounts again without the page being loaded (logout and
      // login, an expired session): what the last layout knew is gone, so a
      // page that has been open for a while looks right away.
      if (performance.now() > RETURN_GAP_MS) look();

      const onReturn = () => {
        if (tabVisible() && Date.now() - lastLook >= RETURN_GAP_MS) look();
      };
      document.addEventListener("visibilitychange", onReturn);
      window.addEventListener("online", onReturn);
      const clock = window.setInterval(() => {
        if (tabVisible()) look();
      }, SLOW_CLOCK_MS);
      cleanups.push(() => {
        document.removeEventListener("visibilitychange", onReturn);
        window.removeEventListener("online", onReturn);
        window.clearInterval(clock);
      });

      // The listener is called at once with the current value (false) and
      // then with true and false in a row at each reconnection after a drop.
      const unsubscribe = socketManager?.subscribeWsRefreshRequired?.(
        reconnected => {
          if (!reconnected || found) return;
          stopLooking();
          AFTER_RECONNECT_MS.forEach(lookIn);
        }
      );
      if (typeof unsubscribe === "function") cleanups.push(unsubscribe);
    }

    return () => {
      active = false;
      stopLooking();
      cleanups.forEach(cleanup => cleanup());
    };
  }, [socketManager]);

  return available;
};

export default useAppUpdate;
