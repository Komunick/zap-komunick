import {
  SPOTLIGHT_PADDING,
  TOP_RESERVE,
  clipToViewport,
  placeBalloon,
  sameRect,
  unionRect
} from "./tourGeometry";

const screen = { width: 1280, height: 720 };
const balloon = { width: 370, height: 220 };

const inside = (place, size = balloon, view = screen) =>
  place.left >= 0 &&
  place.top >= 0 &&
  place.left + size.width <= view.width &&
  place.top + size.height <= view.height;

describe("unionRect", () => {
  it("wraps every target of a step in one rectangle", () => {
    expect(
      unionRect([
        { left: 10, top: 100, width: 200, height: 48 },
        { left: 10, top: 154, width: 200, height: 48 },
        { left: 10, top: 208, width: 220, height: 48 }
      ])
    ).toEqual({ left: 10, top: 100, width: 220, height: 156 });
  });

  it("ignores what is not on screen and returns null when nothing is", () => {
    expect(
      unionRect([
        { left: 0, top: 0, width: 0, height: 0 },
        { left: 30, top: 40, width: 50, height: 60 }
      ])
    ).toEqual({ left: 30, top: 40, width: 50, height: 60 });
    expect(unionRect([{ left: 0, top: 0, width: 0, height: 0 }])).toBeNull();
    expect(unionRect([])).toBeNull();
    expect(unionRect(null)).toBeNull();
  });
});

describe("clipToViewport", () => {
  it("keeps only the part of the target that can be seen", () => {
    expect(
      clipToViewport({ left: 400, top: 60, width: 1200, height: 900 }, screen)
    ).toEqual({ left: 400, top: 60, width: 880, height: 660 });
  });

  it("returns null for a target that is entirely off screen", () => {
    expect(
      clipToViewport({ left: 10, top: 900, width: 200, height: 48 }, screen)
    ).toBeNull();
    expect(clipToViewport(null, screen)).toBeNull();
  });
});

describe("sameRect", () => {
  it("compares by whole pixels, and null only equals null", () => {
    const rect = { left: 10, top: 20, width: 30, height: 40 };
    expect(sameRect(rect, { ...rect, left: 10.3 })).toBe(true);
    expect(sameRect(rect, { ...rect, left: 11 })).toBe(false);
    expect(sameRect(null, null)).toBe(true);
    expect(sameRect(rect, null)).toBe(false);
  });
});

describe("placeBalloon", () => {
  it("sits to the right of a side menu item, arrow at the item's height", () => {
    const target = { left: 10, top: 300, width: 220, height: 48 };
    const place = placeBalloon(target, balloon, screen, "right");

    expect(place.side).toBe("right");
    expect(place.left).toBe(10 + 220 + SPOTLIGHT_PADDING + 14);
    expect(inside(place)).toBe(true);
    // the arrow points at the middle of the item
    expect(place.top + place.arrow.top + 7).toBe(300 + 24);
    expect(place.arrow.left).toBe(-7);
  });

  it("goes below a tab of the top navigation", () => {
    const target = { left: 500, top: 56, width: 110, height: 44 };
    const place = placeBalloon(target, balloon, screen, "below");

    expect(place.side).toBe("below");
    expect(place.top).toBe(56 + 44 + SPOTLIGHT_PADDING + 14);
    expect(place.arrow.top).toBe(-7);
    expect(place.left + place.arrow.left + 7).toBe(555);
    expect(inside(place)).toBe(true);
  });

  it("turns to another side when the wanted one does not fit", () => {
    // item at the bottom right corner: no room on the right nor below
    const corner = { left: 1100, top: 650, width: 160, height: 44 };
    const place = placeBalloon(corner, balloon, screen, "right");
    expect(place.side).toBe("above");
    expect(inside(place)).toBe(true);

    // conversation panel taking the right of the screen: the balloon goes left
    const panel = { left: 460, top: 60, width: 820, height: 660 };
    expect(placeBalloon(panel, balloon, screen, "left").side).toBe("left");
  });

  it("never covers the pill at the top", () => {
    const target = { left: 10, top: 4, width: 220, height: 40 };
    const place = placeBalloon(target, balloon, screen, "right");
    expect(place.top).toBeGreaterThanOrEqual(TOP_RESERVE);
  });

  it("stays on screen over a target that leaves no room around it", () => {
    const whole = { left: 0, top: 0, width: 1280, height: 720 };
    const place = placeBalloon(whole, balloon, screen, "left");
    expect(place.side).toBe("over");
    expect(place.arrow).toBeNull();
    expect(inside(place)).toBe(true);
  });

  it("fits a phone screen", () => {
    const phone = { width: 360, height: 640 };
    const small = { width: 336, height: 260 };
    const target = { left: 8, top: 60, width: 344, height: 48 };
    const place = placeBalloon(target, small, phone, "right");
    expect(place.side).toBe("below");
    expect(inside(place, small, phone)).toBe(true);
  });
});
