import React, { useEffect, useMemo, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import clsx from "clsx";

import { i18n } from "../../translate/i18n";
import ContactModal from "../ContactModal";
import { TicketNotes } from "../TicketNotes";
import useSettings from "../../hooks/useSettings";
import { generateColor } from "../../helpers/colorGenerator";
import { getInitials } from "../../helpers/getInitials";
import {
  formatWhatsappContactName,
  formatWhatsappContactNumber
} from "../../helpers/formatWhatsappDisplay";
import {
  formatMinutes,
  isSlaBreached,
  slaWaitingMinutes
} from "../../helpers/sla";

// Zap Komunick: fixed customer panel beside the conversation (wide screens).
// Wallet owner, queue, attendant, SLA clock, tags, notes and the contact edit.

const useStyles = makeStyles(theme => ({
  panel: {
    flex: "none",
    width: 320,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    borderLeft: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    // the upstream CssBaseline is outside the theme: set the ink explicitly
    color: theme.palette.text.primary,
    ...theme.scrollbarStyles
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 16px 14px"
  },
  avatar: {
    width: 48,
    height: 48,
    fontWeight: 700,
    color: "#FFFFFF"
  },
  name: {
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.25,
    color: theme.palette.text.primary
  },
  number: {
    fontSize: 13,
    color: theme.palette.text.secondary
  },
  section: {
    padding: "14px 16px",
    borderTop: `1px solid ${theme.palette.divider}`
  },
  sectionTitle: {
    marginBottom: 10,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "3px 0",
    fontSize: 14
  },
  rowLabel: {
    color: theme.palette.text.secondary
  },
  rowValue: {
    minWidth: 0,
    textAlign: "right",
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  muted: {
    color: theme.palette.text.secondary,
    fontWeight: 500
  },
  sla: {
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.komunick.subtle
  },
  slaHot: {
    borderColor: "rgba(198, 40, 40, 0.35)",
    backgroundColor: "rgba(198, 40, 40, 0.08)"
  },
  slaText: {
    fontSize: 14,
    fontWeight: 700
  },
  slaTextHot: {
    color: "#C62828"
  },
  slaLimit: {
    marginTop: 2,
    fontSize: 12,
    color: theme.palette.text.secondary
  },
  bar: {
    height: 4,
    marginTop: 8,
    borderRadius: 2,
    backgroundColor: theme.komunick.border,
    overflow: "hidden"
  },
  barFill: {
    height: "100%",
    backgroundColor: theme.komunick.accent
  },
  barFillHot: {
    backgroundColor: "#C62828"
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6
  },
  tag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 24,
    padding: "0 9px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: theme.komunick.tagBackground
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%"
  },
  extra: {
    fontSize: 13,
    padding: "2px 0"
  },
  edit: {
    margin: "0 16px 16px",
    alignSelf: "stretch"
  }
}));

const CustomerPanel = ({ ticket, contact, loading }) => {
  const classes = useStyles();
  const { getSetting } = useSettings();
  const [slaMinutes, setSlaMinutes] = useState("0");
  const [modalOpen, setModalOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    getSetting("slaMinutes", "0")
      .then(value => setSlaMinutes(value))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the waiting time is relative to "now": refresh it every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const tags = useMemo(() => {
    const all = [...(ticket?.tags || []), ...(contact?.tags || [])];
    const seen = new Set();
    return all.filter(tag => (seen.has(tag.id) ? false : seen.add(tag.id)));
  }, [ticket, contact]);

  if (loading || !contact?.id) {
    return <aside className={classes.panel} aria-busy="true" />;
  }

  const name = formatWhatsappContactName(contact, ticket);
  const waiting = slaWaitingMinutes(ticket);
  const limit = Number(slaMinutes) || 0;
  const breached = isSlaBreached(ticket, slaMinutes);
  const progress =
    waiting !== null && limit > 0 ? Math.min(100, (waiting / limit) * 100) : 0;

  return (
    <aside
      className={classes.panel}
      aria-label={i18n.t("customerPanel.title")}
    >
      <div className={classes.header}>
        <Avatar
          className={classes.avatar}
          style={{ backgroundColor: generateColor(contact.number) }}
          src={contact.profilePicUrl}
        >
          {getInitials(name)}
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <Typography noWrap className={classes.name}>
            {name}
          </Typography>
          <Typography noWrap className={classes.number}>
            {formatWhatsappContactNumber(contact)}
          </Typography>
        </div>
      </div>

      <div className={classes.section}>
        <div className={classes.row}>
          <span className={classes.rowLabel}>
            {i18n.t("customerPanel.wallet")}
          </span>
          <span
            className={clsx(
              classes.rowValue,
              !contact.walletUser && classes.muted
            )}
          >
            {contact.walletUser?.name || i18n.t("customerPanel.noWallet")}
          </span>
        </div>
        <div className={classes.row}>
          <span className={classes.rowLabel}>
            {i18n.t("customerPanel.queue")}
          </span>
          <span className={classes.rowValue}>
            {ticket?.queue?.name || (
              <span className={classes.muted}>
                {i18n.t("customerPanel.noQueue")}
              </span>
            )}
          </span>
        </div>
        <div className={classes.row}>
          <span className={classes.rowLabel}>
            {i18n.t("customerPanel.attendant")}
          </span>
          <span
            className={clsx(classes.rowValue, !ticket?.user && classes.muted)}
          >
            {ticket?.user?.name || i18n.t("customerPanel.noAttendant")}
          </span>
        </div>
      </div>

      <div className={classes.section}>
        <div className={classes.sectionTitle}>{i18n.t("customerPanel.sla")}</div>
        <div className={clsx(classes.sla, breached && classes.slaHot)}>
          {waiting !== null ? (
            <>
              <div
                className={clsx(classes.slaText, breached && classes.slaTextHot)}
              >
                {i18n.t("customerPanel.waiting", {
                  time: formatMinutes(waiting)
                })}
              </div>
              {limit > 0 && (
                <>
                  <div className={classes.slaLimit}>
                    {i18n.t("customerPanel.limit", { minutes: limit })}
                  </div>
                  <div className={classes.bar}>
                    <div
                      className={clsx(
                        classes.barFill,
                        breached && classes.barFillHot
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <div className={classes.slaText}>
              {i18n.t("customerPanel.answered")}
            </div>
          )}
        </div>
      </div>

      <div className={classes.section}>
        <div className={classes.sectionTitle}>{i18n.t("customerPanel.tags")}</div>
        {tags.length === 0 ? (
          <span className={classes.muted}>{i18n.t("customerPanel.noTags")}</span>
        ) : (
          <div className={classes.tags}>
            {tags.map(tag => (
              <span key={tag.id} className={classes.tag}>
                <span
                  className={classes.dot}
                  style={{ backgroundColor: tag.color || "#7C7C7C" }}
                />
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {contact?.extraInfo?.length > 0 && (
        <div className={classes.section}>
          <div className={classes.sectionTitle}>
            {i18n.t("contactModal.form.extraInfo")}
          </div>
          {contact.extraInfo.map(info => (
            <div key={info.id || info.name} className={classes.extra}>
              <strong>{info.name}:</strong> {info.value}
            </div>
          ))}
        </div>
      )}

      <div className={classes.section}>
        <div className={classes.sectionTitle}>{i18n.t("customerPanel.notes")}</div>
        <TicketNotes ticket={ticket} />
      </div>

      <Button
        variant="outlined"
        className={classes.edit}
        onClick={() => setModalOpen(true)}
      >
        {i18n.t("customerPanel.edit")}
      </Button>
      <ContactModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        contactId={contact.id}
      />
    </aside>
  );
};

export default CustomerPanel;
