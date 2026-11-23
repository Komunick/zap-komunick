// Zap Komunick: whether the contact panel beside the conversation is
// collapsed, remembered per user on this browser. Storage may be blocked
// (private mode, policies); the panel then simply starts open.
const key = userId => `superchat.customerPanel.collapsed.${userId}`;

export const readCustomerPanelCollapsed = userId => {
  if (userId === undefined || userId === null) return false;
  try {
    return window.localStorage.getItem(key(userId)) === "1";
  } catch {
    return false;
  }
};

export const writeCustomerPanelCollapsed = (userId, collapsed) => {
  if (userId === undefined || userId === null) return;
  try {
    if (collapsed) window.localStorage.setItem(key(userId), "1");
    else window.localStorage.removeItem(key(userId));
  } catch {
    // Not remembered; the current screen still follows the choice.
  }
};
