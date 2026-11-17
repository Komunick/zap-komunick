import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import QueueOrderList, { moveQueueId } from "./QueueOrderList";

const queues = [
  { id: 8, name: "Legalização", color: "#111" },
  { id: 9, name: "Financeiro", color: "#222" },
  { id: 3, name: "Pessoal", color: "#333" }
];

describe("moveQueueId", () => {
  it("swaps the queue with its neighbour", () => {
    expect(moveQueueId([8, 9, 3], 1, -1)).toEqual([9, 8, 3]);
    expect(moveQueueId([8, 9, 3], 1, 1)).toEqual([8, 3, 9]);
  });

  it("keeps the list at the edges", () => {
    const ids = [8, 9, 3];
    expect(moveQueueId(ids, 0, -1)).toBe(ids);
    expect(moveQueueId(ids, 2, 1)).toBe(ids);
    expect(moveQueueId(ids, 5, -1)).toBe(ids);
  });
});

describe("QueueOrderList", () => {
  it("shows the queues numbered in the menu order", () => {
    render(
      <QueueOrderList
        queueIds={[9, 8, 3]}
        queues={queues}
        onChange={jest.fn()}
      />
    );
    const rows = screen.getAllByRole("listitem").map(row => row.textContent);
    expect(rows).toEqual(["1Financeiro", "2Legalização", "3Pessoal"]);
  });

  it("moves a queue up and down", () => {
    const onChange = jest.fn();
    render(
      <QueueOrderList
        queueIds={[8, 9, 3]}
        queues={queues}
        onChange={onChange}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Subir Financeiro no menu" })
    );
    expect(onChange).toHaveBeenLastCalledWith([9, 8, 3]);

    fireEvent.click(
      screen.getByRole("button", { name: "Descer Legalização no menu" })
    );
    expect(onChange).toHaveBeenLastCalledWith([9, 8, 3]);
  });

  it("disables the moves that leave the list", () => {
    render(
      <QueueOrderList
        queueIds={[8, 9, 3]}
        queues={queues}
        onChange={jest.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: "Subir Legalização no menu" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Descer Pessoal no menu" })
    ).toBeDisabled();
  });

  it("is hidden with less than two queues", () => {
    const { container } = render(
      <QueueOrderList queueIds={[8]} queues={queues} onChange={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
