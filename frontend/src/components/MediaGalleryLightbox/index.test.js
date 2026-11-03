import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MediaGalleryLightbox, { buildMediaGalleryData } from "./index";

let mockLightboxProps;
jest.mock("yet-another-react-lightbox", () => ({
  __esModule: true,
  IconButton: () => null,
  default: props => {
    mockLightboxProps = props;
    if (!props.open) return null;
    const slide = props.slides[0];
    const video = require("react").createElement("video", {
      "data-testid": "gallery-video",
      src: slide.sources[0].src,
      crossOrigin: props.video?.crossOrigin
    });
    return props.render.slideContainer({ slide, children: video });
  }
}));
jest.mock("yet-another-react-lightbox/plugins/captions", () => () => null, {
  virtual: true
});
jest.mock("yet-another-react-lightbox/plugins/download", () => () => null, {
  virtual: true
});
jest.mock("yet-another-react-lightbox/plugins/thumbnails", () => () => null, {
  virtual: true
});
jest.mock("yet-another-react-lightbox/plugins/video", () => () => null, {
  virtual: true
});
jest.mock("yet-another-react-lightbox/plugins/zoom", () => () => null, {
  virtual: true
});
jest.mock("yet-another-react-lightbox/plugins/captions.css", () => ({}), {
  virtual: true
});
jest.mock("yet-another-react-lightbox/plugins/thumbnails.css", () => ({}), {
  virtual: true
});
jest.mock("yet-another-react-lightbox/styles.css", () => ({}), {
  virtual: true
});

const fixture = id => ({
  id,
  mediaType: id === 1 ? "image" : "video",
  mediaUrl: `https://backend.example.invalid/chats/101/messages/${id}/media`,
  mediaName: id === 1 ? "imagem-ficticia.png" : "video-ficticio.mp4"
});

beforeEach(() => {
  mockLightboxProps = null;
  HTMLMediaElement.prototype.pause = jest.fn();
  HTMLMediaElement.prototype.load = jest.fn();
});

test("private identity URLs retain original filenames in image and video downloads", () => {
  const { slides } = buildMediaGalleryData([fixture(1), fixture(2)], {
    getFileName: message => message.mediaName
  });
  expect(slides.map(slide => slide.download.filename)).toEqual([
    "imagem-ficticia.png",
    "video-ficticio.mp4"
  ]);
});

test("ticket callers keep the legacy filename default", () => {
  const { slides } = buildMediaGalleryData([
    {
      id: 8,
      mediaType: "image",
      mediaUrl: "https://backend.example.invalid/public/ticket-image.png"
    }
  ]);
  expect(slides[0].download.filename).toBe("ticket-image.png");
});

test("private galleries use credentialed media and delegate download without the public XHR fallback", () => {
  const onDownload = jest.fn();
  const slides = buildMediaGalleryData([fixture(2)]).slides;
  render(
    <MediaGalleryLightbox
      open
      slides={slides}
      index={0}
      onClose={jest.fn()}
      privateMedia
      crossOrigin="use-credentials"
      onDownload={onDownload}
    />
  );
  expect(mockLightboxProps.carousel?.imageProps?.crossOrigin).toBe(
    "use-credentials"
  );
  expect(mockLightboxProps.video?.crossOrigin).toBe("use-credentials");
  mockLightboxProps.download.download({ slide: slides[0] });
  expect(onDownload).toHaveBeenCalledWith(slides[0]);
});

test("closing a private gallery releases its actual native player and captures access errors", () => {
  const onMediaError = jest.fn();
  const slides = buildMediaGalleryData([fixture(2)]).slides;
  const props = {
    slides,
    index: 0,
    onClose: jest.fn(),
    privateMedia: true,
    onMediaError
  };
  const view = render(<MediaGalleryLightbox {...props} open />);
  const video = screen.getByTestId("gallery-video");
  fireEvent.error(video);
  expect(onMediaError).toHaveBeenCalledTimes(1);
  view.rerender(<MediaGalleryLightbox {...props} open={false} />);
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
  expect(video).not.toHaveAttribute("src");
});
