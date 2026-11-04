import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import MediaGalleryLightbox, { buildMediaGalleryData } from "./index";

// Exercise the installed Lightbox and Thumbnails plugin, without replacing them
// with a mock that would hide the plugin's independent ImageSlide renderer.
const imageUrl = "http://127.0.0.1:5491/chats/101/messages/7/media";
const videoUrl = "http://127.0.0.1:5491/chats/101/messages/8/media";
const slides = buildMediaGalleryData([
  { id: 7, mediaType: "image", mediaUrl: imageUrl },
  { id: 8, mediaType: "video", mediaUrl: videoUrl }
]).slides;
let clientWidth, clientHeight;

beforeEach(() => {
  clientWidth = jest
    .spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockReturnValue(900);
  clientHeight = jest
    .spyOn(HTMLElement.prototype, "clientHeight", "get")
    .mockReturnValue(600);
  HTMLMediaElement.prototype.pause = jest.fn();
  HTMLMediaElement.prototype.load = jest.fn();
});

afterEach(() => {
  clientWidth.mockRestore();
  clientHeight.mockRestore();
});

const thumbnailImages = () =>
  Array.from(
    document.querySelectorAll(".yarl__thumbnails_thumbnail img")
  ).filter(image => image.getAttribute("src") === imageUrl);

function gallery(props = {}) {
  return (
    <MediaGalleryLightbox
      open
      index={0}
      slides={slides}
      onClose={jest.fn()}
      {...props}
    />
  );
}

test("the real thumbnails plugin requests private images with the main image credentials", async () => {
  render(gallery({ privateMedia: true, crossOrigin: "use-credentials" }));
  await waitFor(() => expect(thumbnailImages().length).toBeGreaterThan(0));
  const mainImage = document.querySelector(
    ".yarl__slide_wrapper img[src='" + imageUrl + "']"
  );
  expect(mainImage).toHaveAttribute("crossorigin", "use-credentials");
  thumbnailImages().forEach(image =>
    expect(image).toHaveAttribute("crossorigin", "use-credentials")
  );
});

test("private thumbnail errors and closing release their actual image nodes", async () => {
  const onMediaError = jest.fn();
  const view = render(
    gallery({
      privateMedia: true,
      crossOrigin: "use-credentials",
      onMediaError
    })
  );
  await waitFor(() => expect(thumbnailImages().length).toBeGreaterThan(0));
  const images = thumbnailImages();
  fireEvent.error(images[0]);
  expect(onMediaError).toHaveBeenCalledTimes(1);
  view.unmount();
  images.forEach(image => expect(image).not.toHaveAttribute("src"));
});

test("public galleries retain the default image thumbnail and video placeholder", async () => {
  render(gallery());
  await waitFor(() => expect(thumbnailImages().length).toBeGreaterThan(0));
  thumbnailImages().forEach(image =>
    expect(image).not.toHaveAttribute("crossorigin")
  );
  expect(
    Array.from(
      document.querySelectorAll(".yarl__thumbnails_thumbnail img")
    ).some(image =>
      image.getAttribute("src")?.startsWith("data:image/svg+xml,")
    )
  ).toBe(true);
});
