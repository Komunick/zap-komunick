import React from "react";
import { Badge } from "@material-ui/core";
import HeadsetMicOutlinedIcon from "@material-ui/icons/HeadsetMicOutlined";
import useSupportSummary from "../../hooks/useSupportSummary";

// Zap Komunick: menu icon of Support, with how many tickets have something
// new for this user (RF-030).
const SupportMenuIcon = () => {
  const { summary } = useSupportSummary();

  return (
    <Badge
      badgeContent={summary.unread || 0}
      color="error"
      max={9}
      overlap="rectangular"
    >
      <HeadsetMicOutlinedIcon />
    </Badge>
  );
};

export default SupportMenuIcon;
