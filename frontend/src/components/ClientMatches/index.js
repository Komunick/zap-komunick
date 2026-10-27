import React, { useEffect, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { getInitials } from "../../helpers/getInitials";

// Zap Komunick: clients found by name or number in the ticket search, also
// the ones without any ticket (address book) or with resolved ones only, with
// a button to talk to them (docs/PRD.md, RF-018).

const useStyles = makeStyles(theme => ({
  box: {
    flex: "none",
    margin: "4px 10px 8px",
    padding: "6px 0",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`
  },
  title: {
    padding: "2px 12px 6px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 12px"
  },
  avatar: {
    width: 32,
    height: 32,
    fontSize: 13,
    fontWeight: 700,
    color: theme.palette.text.primary,
    backgroundColor: theme.komunick.tagBackground
  },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: 600 },
  number: { fontSize: 12, color: theme.palette.text.secondary },
  talk: { textTransform: "none", fontWeight: 600, minWidth: 0 }
}));

export const ClientMatches = ({ searchParam }) => {
  const classes = useStyles();
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const text = (searchParam || "").trim();
    if (text.length < 2) {
      setClients([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      api
        .get("/contacts", { params: { searchParam: text, pageNumber: 1 } })
        .then(({ data }) =>
          setClients((data.contacts || []).filter(c => !c.isGroup).slice(0, 5))
        )
        .catch(() => setClients([]));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchParam]);

  if (!clients.length) return null;

  return (
    <div className={classes.box} aria-label={i18n.t("clients.title")}>
      <div className={classes.title}>{i18n.t("clients.title")}</div>
      {clients.map(client => (
        <div key={client.id} className={classes.row}>
          <Avatar className={classes.avatar} src={client.profilePicUrl}>
            {getInitials(client.name)}
          </Avatar>
          <div className={classes.body}>
            <Typography noWrap className={classes.name}>
              {client.name}
            </Typography>
            <Typography noWrap className={classes.number}>
              {client.number}
            </Typography>
          </div>
          <Button
            size="small"
            color="primary"
            className={classes.talk}
            onClick={() =>
              window.mentionClick({
                contactId: client.id,
                name: client.name,
                number: client.number
              })
            }
          >
            {i18n.t("clients.talk")}
          </Button>
        </div>
      ))}
    </div>
  );
};

export default ClientMatches;
