import { attachmentImageLayout } from "./attachmentImageLayout";

test.each([0, 90, 180, 270])(
  "all four corners remain inside a positive scroll stage at %s degrees, including zoom 3",
  rotation => {
    for (const [naturalWidth, naturalHeight] of [
      [1600, 900],
      [900, 1600]
    ]) {
      for (const [viewportWidth, viewportHeight] of [
        [1200, 650],
        [320, 200]
      ]) {
        for (const zoom of [0.5, 1, 1.25, 3]) {
          const layout = attachmentImageLayout({
            naturalWidth,
            naturalHeight,
            viewportWidth,
            viewportHeight,
            zoom,
            rotation
          });
          // The independent reference rotates each image corner about its center.
          const radians = (rotation * Math.PI) / 180;
          const corners = [-1, 1].flatMap(x =>
            [-1, 1].map(y => {
              const dx = (x * layout.imageWidth * zoom) / 2;
              const dy = (y * layout.imageHeight * zoom) / 2;
              return [
                layout.stageWidth / 2 +
                  dx * Math.cos(radians) -
                  dy * Math.sin(radians),
                layout.stageHeight / 2 +
                  dx * Math.sin(radians) +
                  dy * Math.cos(radians)
              ];
            })
          );
          for (const [x, y] of corners) {
            expect(x).toBeGreaterThanOrEqual(-0.000001);
            expect(y).toBeGreaterThanOrEqual(-0.000001);
            expect(x).toBeLessThanOrEqual(layout.stageWidth + 0.000001);
            expect(y).toBeLessThanOrEqual(layout.stageHeight + 0.000001);
          }
        }
      }
    }
  }
);
test("rotation swaps the fit bounds before zoom rather than clipping a landscape image in portrait", () => {
  const layout = attachmentImageLayout({
    naturalWidth: 1600,
    naturalHeight: 900,
    viewportWidth: 320,
    viewportHeight: 200,
    zoom: 3,
    rotation: 90
  });
  expect(layout).toEqual({
    imageWidth: 200,
    imageHeight: 112.5,
    stageWidth: 338,
    stageHeight: 600
  });
});
test("negative and accumulated quarter turns retain the same geometry", () => {
  const input = {
    naturalWidth: 800,
    naturalHeight: 600,
    viewportWidth: 320,
    viewportHeight: 200,
    zoom: 1.25
  };
  expect(attachmentImageLayout({ ...input, rotation: -90 })).toEqual(
    attachmentImageLayout({ ...input, rotation: 270 })
  );
  expect(attachmentImageLayout({ ...input, rotation: 450 })).toEqual(
    attachmentImageLayout({ ...input, rotation: 90 })
  );
});
test.each([
  { naturalWidth: 0 },
  { naturalHeight: NaN },
  { viewportWidth: 0 },
  { viewportHeight: Infinity },
  { zoom: 0 },
  { zoom: 3.25 },
  { rotation: 45 }
])(
  "invalid or unloaded dimensions do not produce a broken stage: %j",
  override => {
    expect(
      attachmentImageLayout({
        naturalWidth: 800,
        naturalHeight: 600,
        viewportWidth: 320,
        viewportHeight: 200,
        zoom: 1,
        rotation: 0,
        ...override
      })
    ).toBeNull();
  }
);

test.each([0, 90, 180, 270])(
  "fit before zoom stays within the viewport at %s degrees",
  rotation => {
    for (const [naturalWidth, naturalHeight] of [
      [1600, 900],
      [900, 1600]
    ]) {
      for (const [viewportWidth, viewportHeight] of [
        [1200, 650],
        [320, 200]
      ]) {
        for (const zoom of [0.5, 1]) {
          const layout = attachmentImageLayout({
            naturalWidth,
            naturalHeight,
            viewportWidth,
            viewportHeight,
            zoom,
            rotation
          });
          expect(layout.stageWidth).toBeLessThanOrEqual(viewportWidth);
          expect(layout.stageHeight).toBeLessThanOrEqual(viewportHeight);
        }
      }
    }
  }
);
