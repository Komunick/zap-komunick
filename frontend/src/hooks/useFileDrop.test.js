import React from "react";
import "@testing-library/jest-dom";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import useFileDrop from "./useFileDrop";

const Zone = ({ onFiles }) => {
  const { dragging, dropHandlers } = useFileDrop(onFiles);
  return (
    <div data-testid="zone" {...dropHandlers}>
      <p data-testid="child">conversa</p>
      {dragging && <span>solte aqui</span>}
    </div>
  );
};

const withFiles = files => ({
  dataTransfer: { types: ["Files"], files, items: [], dropEffect: "none" }
});
const withText = {
  dataTransfer: { types: ["text/plain"], files: [], items: [] }
};
const pdf = new File(["x"], "contrato.pdf", { type: "application/pdf" });

it("hands the dropped files over and keeps the browser from opening them", () => {
  const onFiles = jest.fn();
  render(<Zone onFiles={onFiles} />);
  const zone = screen.getByTestId("zone");

  fireEvent.dragEnter(zone, withFiles([]));
  expect(screen.getByText("solte aqui")).toBeInTheDocument();

  const drop = createEvent.drop(zone, withFiles([pdf]));
  fireEvent(zone, drop);

  expect(drop.defaultPrevented).toBe(true);
  expect(onFiles).toHaveBeenCalledWith([pdf]);
  expect(screen.queryByText("solte aqui")).not.toBeInTheDocument();
});

it("allows the drop by cancelling dragover, which browsers require", () => {
  render(<Zone onFiles={jest.fn()} />);
  const zone = screen.getByTestId("zone");
  const data = withFiles([]);

  const over = createEvent.dragOver(zone, data);
  fireEvent(zone, over);

  expect(over.defaultPrevented).toBe(true);
  expect(data.dataTransfer.dropEffect).toBe("copy");
});

it("stays lit while the pointer moves across the children of the area", () => {
  render(<Zone onFiles={jest.fn()} />);
  const zone = screen.getByTestId("zone");
  const child = screen.getByTestId("child");

  fireEvent.dragEnter(zone, withFiles([]));
  fireEvent.dragEnter(child, withFiles([]));
  fireEvent.dragLeave(zone, withFiles([]));
  expect(screen.getByText("solte aqui")).toBeInTheDocument();

  fireEvent.dragLeave(child, withFiles([]));
  expect(screen.queryByText("solte aqui")).not.toBeInTheDocument();
});

it("leaves dragged text and links to the browser", () => {
  const onFiles = jest.fn();
  render(<Zone onFiles={onFiles} />);
  const zone = screen.getByTestId("zone");

  fireEvent.dragEnter(zone, withText);
  expect(screen.queryByText("solte aqui")).not.toBeInTheDocument();

  const drop = createEvent.drop(zone, withText);
  fireEvent(zone, drop);
  expect(drop.defaultPrevented).toBe(false);
  expect(onFiles).not.toHaveBeenCalled();
});

it("marks a dragged folder so it can be left out", () => {
  const onFiles = jest.fn();
  render(<Zone onFiles={onFiles} />);
  const folder = new File([""], "Documentos");

  fireEvent.drop(screen.getByTestId("zone"), {
    dataTransfer: {
      types: ["Files"],
      files: [pdf, folder],
      items: [
        { kind: "file", webkitGetAsEntry: () => ({ isDirectory: false }) },
        { kind: "file", webkitGetAsEntry: () => ({ isDirectory: true }) }
      ]
    }
  });

  expect(onFiles).toHaveBeenCalledWith([
    pdf,
    { name: "Documentos", isFolder: true }
  ]);
});
