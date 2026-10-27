import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import useTicketDraft from "./index";

let oldSetter;
function Composer({ ticketId }) {
  const [value, setValue] = useTicketDraft(ticketId);
  oldSetter = oldSetter || setValue;
  return (
    <>
      <textarea
        aria-label="Human draft"
        value={value}
        onChange={event => setValue(event.target.value)}
      />
      <button
        onClick={() =>
          setValue(previous =>
            previous ? `${previous}\n\nReviewed fixture` : "Reviewed fixture"
          )
        }
      >
        Use reviewed fixture
      </button>
    </>
  );
}
beforeEach(() => {
  sessionStorage.clear();
  oldSetter = null;
});
test("keeps distinct drafts across ticket switches and appends only after acceptance", () => {
  sessionStorage.setItem("messageDraft-301", "Human A");
  sessionStorage.setItem("messageDraft-302", "Human B");
  const view = render(<Composer ticketId={301} />);
  expect(screen.getByLabelText("Human draft")).toHaveValue("Human A");
  fireEvent.click(screen.getByText("Use reviewed fixture"));
  expect(screen.getByLabelText("Human draft")).toHaveValue(
    "Human A\n\nReviewed fixture"
  );
  view.rerender(<Composer ticketId={302} />);
  expect(screen.getByLabelText("Human draft")).toHaveValue("Human B");
  view.rerender(<Composer ticketId={301} />);
  expect(screen.getByLabelText("Human draft")).toHaveValue(
    "Human A\n\nReviewed fixture"
  );
  expect(sessionStorage.getItem("messageDraft-302")).toBe("Human B");
});
test("ignores an old ticket setter after switching and does not erase another draft", () => {
  const view = render(<Composer ticketId={301} />);
  fireEvent.change(screen.getByLabelText("Human draft"), {
    target: { value: "Human A" }
  });
  view.rerender(<Composer ticketId={302} />);
  fireEvent.change(screen.getByLabelText("Human draft"), {
    target: { value: "Human B" }
  });
  oldSetter("Late A");
  expect(screen.getByLabelText("Human draft")).toHaveValue("Human B");
  expect(sessionStorage.getItem("messageDraft-301")).toBe("Human A");
  expect(sessionStorage.getItem("messageDraft-302")).toBe("Human B");
});

test("an unresolved ticket cannot create or load an undefined draft owner", () => {
  sessionStorage.setItem("messageDraft-301", "Human A");
  const view = render(<Composer ticketId={undefined} />);
  fireEvent.change(screen.getByLabelText("Human draft"), {
    target: { value: "Before load" }
  });
  expect(screen.getByLabelText("Human draft")).toHaveValue("");
  expect(sessionStorage.getItem("messageDraft-undefined")).toBeNull();
  view.rerender(<Composer ticketId={301} />);
  expect(screen.getByLabelText("Human draft")).toHaveValue("Human A");
});
