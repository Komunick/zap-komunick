// Zap Komunick: CSS transforms do not reserve layout space. The stage must
// contain the rotated, zoomed bounds so scroll never needs negative offsets.
export const attachmentImageLayout = ({
  naturalWidth,
  naturalHeight,
  viewportWidth,
  viewportHeight,
  zoom,
  rotation
}) => {
  if (
    ![naturalWidth, naturalHeight, viewportWidth, viewportHeight, zoom].every(
      value => Number.isFinite(value) && value > 0
    ) ||
    !Number.isFinite(rotation) ||
    rotation % 90 !== 0 ||
    zoom < 0.5 ||
    zoom > 3
  )
    return null;
  const angle = ((rotation % 360) + 360) % 360;
  const swapped = angle === 90 || angle === 270;
  const rotatedWidth = swapped ? naturalHeight : naturalWidth;
  const rotatedHeight = swapped ? naturalWidth : naturalHeight;
  const fit = Math.min(
    1,
    viewportWidth / rotatedWidth,
    viewportHeight / rotatedHeight
  );
  return {
    imageWidth: naturalWidth * fit,
    imageHeight: naturalHeight * fit,
    stageWidth: Math.ceil(rotatedWidth * fit * zoom),
    stageHeight: Math.ceil(rotatedHeight * fit * zoom)
  };
};
