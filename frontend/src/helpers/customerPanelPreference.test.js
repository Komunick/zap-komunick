import {
  readCustomerPanelCollapsed,
  writeCustomerPanelCollapsed
} from "./customerPanelPreference";

beforeEach(() => localStorage.clear());

test("the preference is kept per user", () => {
  writeCustomerPanelCollapsed(101, true);

  expect(readCustomerPanelCollapsed(101)).toBe(true);
  expect(readCustomerPanelCollapsed(102)).toBe(false);

  writeCustomerPanelCollapsed(101, false);
  expect(readCustomerPanelCollapsed(101)).toBe(false);
});

test("blocked storage or an unknown user leaves the panel open", () => {
  const getItem = jest
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation(() => {
      throw new Error("blocked");
    });
  expect(readCustomerPanelCollapsed(101)).toBe(false);
  getItem.mockRestore();
  expect(readCustomerPanelCollapsed(undefined)).toBe(false);
  expect(() => writeCustomerPanelCollapsed(undefined, true)).not.toThrow();
});
