import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MessageAttachment from "./index";
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("react-whatsmarked", () => ({ children }) => <span>{children}</span>);
const message = {
  id: "fixture",
  ticketId: 301,
  mediaType: "application",
  body: "fixture.pdf",
  mediaUrl: "https://invalid.example/fixture.pdf"
};
const props = extra => ({
  message,
  classes: {},
  canView: true,
  onView: jest.fn(),
  ...extra
});
test("PDF without protocol JSON has a PDF card and never a video element", () => {
  const p = props();
  render(<MessageAttachment {...p} />);
  expect(screen.queryByLabelText("attachments.video")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "attachments.viewPdf" }));
  expect(p.onView).toHaveBeenCalledWith(message);
});
test.each([{ isDeleted: true }, {}])(
  "deleted or unavailable context cannot gain viewer access",
  extra => {
    const p = props({
      message: { ...message, ...extra },
      canView: !!extra.isDeleted
    });
    render(<MessageAttachment {...p} />);
    expect(
      screen.getByRole("button", { name: "attachments.viewPdf" })
    ).toBeDisabled();
    expect(p.onView).not.toHaveBeenCalled();
  }
);
test("video classification is positive and inline controls do not autoplay", () => {
  render(
    <MessageAttachment
      {...props({
        message: {
          ...message,
          mediaType: "video",
          body: "fixture.mp4",
          mediaUrl: "https://invalid.example/fixture.mp4"
        }
      })}
    />
  );
  const video = screen.getByLabelText("attachments.video", {
    selector: "video"
  });
  expect(video).toHaveAttribute("controls");
  expect(video).toHaveAttribute("playsinline");
  expect(video).not.toHaveAttribute("autoplay");
});

beforeEach(() => {
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
const videoMessage = {
  ...message,
  mediaType: "video",
  body: "fixture.mp4",
  mediaUrl: "https://invalid.example/fixture.mp4"
};
test("expanding a video pauses its inline player before opening the viewer", () => {
  const p = props({
    message: videoMessage,
    onView: jest.fn(() =>
      expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1)
    )
  });
  render(<MessageAttachment {...p} />);
  fireEvent.click(screen.getByRole("button", { name: "attachments.expand" }));
  expect(p.onView).toHaveBeenCalledWith(videoMessage);
});
test("URL changes and unmount pause the captured inline video node", () => {
  const view = render(
    <MessageAttachment {...props({ message: videoMessage })} />
  );
  const video = screen.getByLabelText("attachments.video", {
    selector: "video"
  });
  view.rerender(
    <MessageAttachment
      {...props({
        message: {
          ...videoMessage,
          mediaUrl: "https://invalid.example/fixture-second.mp4"
        }
      })}
    />
  );
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  expect(HTMLMediaElement.prototype.pause.mock.instances[0]).toBe(video);
  view.unmount();
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2);
});
