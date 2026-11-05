import React, { useEffect, useState, useContext } from "react";
import QRCode from "qrcode.react";
import toastError from "../../errors/toastError";

import {
  Dialog,
  DialogContent,
  Paper,
  Typography,
  Button,
  makeStyles
} from "@material-ui/core";
import { ExtensionOutlined } from "@material-ui/icons";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import { SocketContext } from "../../context/Socket/SocketContext";

const useStyles = makeStyles(theme => ({
  qrcodeFrame: {
    padding: "10px",
    backgroundColor: "#fff",
    boxSizing: "border-box",
    maxWidth: "100%",
    height: "auto"
  },
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: theme.spacing(2),
    gap: theme.spacing(2)
  },
  extensionAction: {
    marginTop: theme.spacing(1)
  }
}));

const QrcodeModal = ({
  open,
  onClose,
  whatsAppId,
  onOpenPasskeyModal,
  connectorReady = false,
  generateOnOpen = false
}) => {
  const [requestingCapture, setRequestingCapture] = useState(false);
  const [requestingQr, setRequestingQr] = useState(generateOnOpen);
  const [attempt, setAttempt] = useState(generateOnOpen ? 1 : 0);
  const [session, setSession] = useState(null);
  const [readFailed, setReadFailed] = useState(false);
  const classes = useStyles();
  const socketManager = useContext(SocketContext);
  const status = session?.status;
  const qrCode = status === "qrcode" ? session.qrcode : null;

  useEffect(() => {
    if (!open || !whatsAppId) return;

    const lifetime = new AbortController();
    const sessionUrl = `/whatsappsession/${whatsAppId}`;
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.GetSocket(companyId);
    const eventName = `company-${companyId}-whatsappSession`;
    let pendingRead;

    const readSession = async (force = false) => {
      if (lifetime.signal.aborted || (pendingRead && !force)) return;
      pendingRead?.abort();
      const request = new AbortController();
      pendingRead = request;
      try {
        const { data } = await api.get(`${sessionUrl}/qr`, {
          signal: request.signal,
          timeout: 10000
        });
        if (request.signal.aborted) return;
        setSession(data);
        setReadFailed(false);
      } catch {
        if (request.signal.aborted) return;
        setSession(null);
        setReadFailed(true);
      } finally {
        if (pendingRead === request) pendingRead = undefined;
      }
    };

    const onSessionUpdate = data => {
      if (data.action === "update" && data.session?.id === whatsAppId) {
        if (data.session.status !== "qrcode") {
          setSession({ status: data.session.status });
        }
        readSession(true);
      }
    };

    const generateQr = async () => {
      try {
        await api.put(sessionUrl, undefined, {
          signal: lifetime.signal,
          timeout: 10000
        });
      } catch (err) {
        if (!lifetime.signal.aborted && err.response?.status !== 409) {
          toastError(err);
        }
      }
      await readSession(true);
      if (!lifetime.signal.aborted) setRequestingQr(false);
    };

    socket.on(eventName, onSessionUpdate);
    if (attempt) generateQr();
    else readSession();
    const refresh = setInterval(() => readSession(), 3000);

    return () => {
      lifetime.abort();
      pendingRead?.abort();
      clearInterval(refresh);
      socket.disconnect();
    };
  }, [open, whatsAppId, socketManager, attempt]);

  useEffect(() => {
    if (status === "CONNECTED") onClose();
    if (status === "passkey_required") onOpenPasskeyModal?.();
  }, [status, onClose, onOpenPasskeyModal]);

  const retry = () => {
    setRequestingQr(true);
    setReadFailed(false);
    setSession(null);
    setAttempt(previous => previous + 1);
  };

  let message = i18n.t("qrCode.waiting");
  if (!requestingQr && readFailed) message = i18n.t("qrCode.unavailable");
  if (!requestingQr && status === "DISCONNECTED") {
    message = i18n.t("qrCode.expired");
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" scroll="paper">
      <DialogContent>
        <Paper elevation={0} className={classes.content}>
          {qrCode ? (
            <>
              <Typography color="primary" gutterBottom>
                {i18n.t("qrCode.scan")}
              </Typography>
              <QRCode
                className={classes.qrcodeFrame}
                value={qrCode}
                size={256}
                renderAs="svg"
                role="img"
                aria-label={i18n.t("qrCode.label")}
              />
            </>
          ) : (
            <Typography component="span" variant="body1" role="status">
              {message}
            </Typography>
          )}
          {status === "DISCONNECTED" && !requestingQr && (
            <Button variant="contained" color="primary" onClick={retry}>
              {i18n.t("connections.toolTips.newQr")}
            </Button>
          )}
          {connectorReady && (
            <Button
              className={classes.extensionAction}
              variant="contained"
              color="primary"
              size="small"
              disabled={requestingCapture}
              startIcon={<ExtensionOutlined />}
              onClick={async () => {
                if (!whatsAppId) return;
                setRequestingCapture(true);
                try {
                  await api.post(
                    `/whatsappsession/${whatsAppId}/capture-token`
                  );
                } catch (err) {
                  toastError(err);
                } finally {
                  setRequestingCapture(false);
                }
              }}
            >
              {i18n.t("qrCode.startCapture")}
            </Button>
          )}
          {!connectorReady && onOpenPasskeyModal && (
            <Button
              className={classes.extensionAction}
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<ExtensionOutlined />}
              onClick={onOpenPasskeyModal}
            >
              {i18n.t("qrCode.installExtension")}
            </Button>
          )}
        </Paper>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(QrcodeModal);
