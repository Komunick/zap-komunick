// Zap Komunick: where the tour balloon goes, from the rectangle of the element
// the step points at (docs/PRD.md, RF-031). Pure, so the edge cases (target in
// a corner, narrow screen) are tested without a browser.

// Gap between the spotlight and the balloon, and between the balloon and the
// edge of the screen.
const GAP = 14;
const MARGIN = 12;
// The spotlight draws this much room around the target.
export const SPOTLIGHT_PADDING = 6;
// The top of the screen belongs to the "Step n of N" pill and to "Leave tour".
export const TOP_RESERVE = 52;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const sameRect = (a, b) => {
  if (!a || !b) return a === b;
  return ["left", "top", "width", "height"].every(
    side => Math.round(a[side]) === Math.round(b[side])
  );
};

// One rectangle around every given one (a step may point at a group of menu
// items). Empty rectangles are elements that are not on screen.
export const unionRect = rects => {
  const visible = (rects || []).filter(
    rect => rect && (rect.width > 0 || rect.height > 0)
  );
  if (!visible.length) return null;
  const left = Math.min(...visible.map(rect => rect.left));
  const top = Math.min(...visible.map(rect => rect.top));
  const right = Math.max(...visible.map(rect => rect.left + rect.width));
  const bottom = Math.max(...visible.map(rect => rect.top + rect.height));
  return { left, top, width: right - left, height: bottom - top };
};

// A target taller or wider than the screen (a whole column) is lit only where
// it can be seen, so the balloon still has a visible edge to hang on.
export const clipToViewport = (rect, viewport) => {
  if (!rect) return null;
  const left = clamp(rect.left, 0, viewport.width);
  const top = clamp(rect.top, 0, viewport.height);
  const right = clamp(rect.left + rect.width, 0, viewport.width);
  const bottom = clamp(rect.top + rect.height, 0, viewport.height);
  if (right - left <= 0 || bottom - top <= 0) return null;
  return { left, top, width: right - left, height: bottom - top };
};

const fits = (target, balloon, viewport) => {
  const reach = SPOTLIGHT_PADDING + GAP;
  return {
    below:
      target.top + target.height + reach + balloon.height <=
      viewport.height - MARGIN,
    above: target.top - reach - balloon.height >= TOP_RESERVE,
    right:
      target.left + target.width + reach + balloon.width <=
      viewport.width - MARGIN,
    left: target.left - reach - balloon.width >= MARGIN
  };
};

const FALLBACKS = {
  right: ["right", "below", "above", "left"],
  left: ["left", "below", "above", "right"],
  below: ["below", "above", "right", "left"],
  above: ["above", "below", "right", "left"]
};

// The step asks for a side; when the balloon does not fit there it turns to
// the next one that fits. It never leaves the screen, and the arrow keeps
// pointing at the target. `arrow` is null when the balloon had to sit on top
// of the target (nothing fits: a target that takes the whole screen).
export const placeBalloon = (target, balloon, viewport, wanted = "below") => {
  const room = fits(target, balloon, viewport);
  const side = (FALLBACKS[wanted] || FALLBACKS.below).find(name => room[name]);
  const reach = SPOTLIGHT_PADDING + GAP;
  const maxLeft = Math.max(MARGIN, viewport.width - balloon.width - MARGIN);
  const maxTop = Math.max(
    TOP_RESERVE,
    viewport.height - balloon.height - MARGIN
  );

  if (!side) {
    return {
      side: "over",
      left: clamp(
        target.left + target.width / 2 - balloon.width / 2,
        MARGIN,
        maxLeft
      ),
      top: maxTop,
      arrow: null
    };
  }

  if (side === "right" || side === "left") {
    const left =
      side === "right"
        ? target.left + target.width + reach
        : target.left - reach - balloon.width;
    const top = clamp(
      target.top + target.height / 2 - balloon.height / 2,
      TOP_RESERVE,
      maxTop
    );
    return {
      side,
      left,
      top,
      arrow: {
        left: side === "right" ? -7 : balloon.width - 7,
        top: clamp(
          target.top + target.height / 2 - top - 7,
          14,
          Math.max(14, balloon.height - 28)
        )
      }
    };
  }

  const left = clamp(
    target.left + target.width / 2 - balloon.width / 2,
    MARGIN,
    maxLeft
  );
  const top =
    side === "below"
      ? target.top + target.height + reach
      : target.top - reach - balloon.height;
  return {
    side,
    left,
    top,
    arrow: {
      left: clamp(
        target.left + target.width / 2 - left - 7,
        18,
        Math.max(18, balloon.width - 32)
      ),
      top: side === "below" ? -7 : balloon.height - 7
    }
  };
};
