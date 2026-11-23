import React from "react";
import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";
import { isString } from "lodash";
import {
  describeOpenTicketConflict,
  openTicketFromError
} from "../helpers/openTicketConflict";

const toastError = err => {
  // Zap Komunick: say who has the open ticket (RF-026)
  const openTicket = openTicketFromError(err);
  if (openTicket) {
    const text = describeOpenTicketConflict(openTicket);
    toast.error(
      openTicket.canView && openTicket.uuid ? (
        <span>
          {text}{" "}
          <a href={`/tickets/${openTicket.uuid}`}>
            {i18n.t("openTicketConflict.open")}
          </a>
        </span>
      ) : (
        text
      ),
      {
        toastId: `ERR_OTHER_OPEN_TICKET-${openTicket.id}`,
        autoClose: 12000,
        pauseOnHover: true,
        closeOnClick: false,
        theme: "light"
      }
    );
    return;
  }

  const errorMsg =
    typeof err === "string"
      ? err
      : err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "ERR_UNKNOWN";

  if (errorMsg) {
    if (i18n.exists(`backendErrors.${errorMsg}`)) {
      toast.error(i18n.t(`backendErrors.${errorMsg}`), {
        toastId: errorMsg,
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: true,
        progress: undefined,
        theme: "light"
      });
      return;
    } else {
      toast.error(errorMsg, {
        toastId: errorMsg,
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: true,
        progress: undefined,
        theme: "light"
      });
      return;
    }
  }
  if (isString(err)) {
    toast.error(err);
    return;
  } else {
    toast.error("An error occurred!");
    return;
  }
};

export default toastError;
