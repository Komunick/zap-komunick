import { useEffect, useState } from "react";
import {
  clipToViewport,
  sameRect,
  unionRect
} from "../../helpers/tourGeometry";
import { TOUR_MORE_TARGET } from "../../helpers/featureTour";

// How long a step waits for its target before it gives up and shows the
// explanation as a card (the page of the step may still be loading).
export const TARGET_WAIT_MS = 900;

const elementsOf = keys =>
  keys.flatMap(key =>
    Array.from(document.querySelectorAll(`[data-tour="${key}"]`))
  );

const onScreen = element => {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
};

// The elements the step points at: its own targets when any of them is on
// screen; otherwise the "More" tab that holds the page in the tabs layout.
export const findTourTargets = step => {
  if (!step) return [];
  const own = elementsOf(step.targets || []).filter(onScreen);
  if (own.length || !step.inMenu) return own;
  return elementsOf([TOUR_MORE_TARGET]).filter(onScreen);
};

// Zap Komunick: where the target of the step is on screen (RF-031). The
// target moves: the side menu opens, the page of the step loads, the window is
// resized. Instead of guessing each cause, the tour asks where the target is
// every 140 ms and only updates when the rectangle changed; the CSS transition
// makes it look like one continuous slide.
//
// `settled` turns true when the target was found or the wait ran out, so the
// balloon is not drawn in the wrong place for a moment. `side` is where the
// target itself asks the balloon to be (`data-tour-side`): a tab of the top
// navigation wants it below, whatever the step would rather have.
const useTargetRect = step => {
  const [state, setState] = useState({
    rect: null,
    settled: false,
    side: null
  });

  useEffect(() => {
    if (!step) {
      setState({ rect: null, settled: true, side: null });
      return undefined;
    }
    let scrolled = false;
    let waited = false;
    setState(current => ({ ...current, settled: false }));

    const read = () => {
      const elements = findTourTargets(step);
      if (elements.length && !scrolled) {
        scrolled = true;
        // A menu item below the fold of the side menu comes into view first.
        [...elements].reverse().forEach(element => {
          if (typeof element.scrollIntoView === "function") {
            element.scrollIntoView({ block: "nearest", inline: "nearest" });
          }
        });
      }
      const rect = clipToViewport(
        unionRect(elements.map(element => element.getBoundingClientRect())),
        { width: window.innerWidth, height: window.innerHeight }
      );
      const side = elements[0]?.getAttribute("data-tour-side") || null;
      setState(current => {
        const settled = !!rect || waited;
        if (
          sameRect(current.rect, rect) &&
          current.settled === settled &&
          current.side === side
        ) {
          return current;
        }
        return { rect, settled, side };
      });
    };

    read();
    const clock = window.setInterval(read, 140);
    const wait = window.setTimeout(() => {
      waited = true;
      read();
    }, TARGET_WAIT_MS);
    window.addEventListener("resize", read);
    window.addEventListener("scroll", read, true);
    return () => {
      window.clearInterval(clock);
      window.clearTimeout(wait);
      window.removeEventListener("resize", read);
      window.removeEventListener("scroll", read, true);
    };
  }, [step]);

  return state;
};

export default useTargetRect;
