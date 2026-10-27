import React, { useState } from "react";
import { Button, makeStyles } from "@material-ui/core";
import { Description, CropFree } from "@material-ui/icons";
import { Alert } from "@material-ui/lab";
import clsx from "clsx";
import WhatsMarked from "react-whatsmarked";
import { i18n } from "../../translate/i18n";
import { classifyMessageAttachment } from "../../helpers/attachments";

const useStyles = makeStyles(theme => ({
  imageButton: {
    display: "block",
    background: "transparent",
    border: 0,
    padding: 0,
    cursor: "pointer",
    maxWidth: "100%",
    "&:disabled": { cursor: "default" }
  },
  card: {
    padding: theme.spacing(1),
    border: "1px solid " + (theme.komunick?.border || theme.palette.divider),
    borderRadius: theme.shape.borderRadius,
    background: theme.komunick?.subtle || theme.palette.background.paper,
    maxWidth: 300,
    overflowWrap: "anywhere"
  }
}));
export default function MessageAttachment({
  message,
  data,
  isSticker,
  classes,
  canView,
  onView
}) {
  const local = useStyles();
  const [failed, setFailed] = useState(false);
  const kind = classifyMessageAttachment(message, data);
  const disabled = !canView || !!message.isDeleted;
  const document =
    data?.message?.documentMessage ||
    data?.message?.documentWithCaptionMessage?.message?.documentMessage;
  const fileName =
    document?.fileName ||
    message.fileName ||
    message.body ||
    i18n.t("attachments.file");
  const caption = message.body && message.body !== document?.fileName && (
    <div className={classes.mediaDescription}>
      <WhatsMarked>{message.body}</WhatsMarked>
    </div>
  );
  if (isSticker)
    return (
      <img
        className={clsx(classes.messageMedia, {
          [classes.messageMediaDeleted]: message.isDeleted
        })}
        src={message.mediaUrl}
        alt={i18n.t("attachments.sticker")}
      />
    );
  if (kind === "audio")
    return (
      <>
        <audio className={classes.audioBottom} controls>
          <source src={message.mediaUrl} type="audio/ogg" />
        </audio>
        {message.body && !["🔊", "Áudio"].includes(message.body) && (
          <div className={classes.mediaDescription}>{message.body}</div>
        )}
      </>
    );
  if (kind === "image")
    return (
      <>
        <button
          className={local.imageButton}
          type="button"
          disabled={disabled}
          onClick={() => onView(message)}
          aria-label={i18n.t("attachments.viewImage")}
        >
          <img
            className={clsx(classes.messageMedia, {
              [classes.messageMediaDeleted]: message.isDeleted
            })}
            src={message.mediaUrl}
            alt={i18n.t("attachments.image")}
          />
        </button>
        {caption}
      </>
    );
  if (kind === "video")
    return (
      <>
        <video
          className={classes.videoPreviewMedia}
          src={message.mediaUrl}
          controls
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          aria-label={i18n.t("attachments.video")}
        />
        {failed && (
          <Alert severity="warning">{i18n.t("attachments.codec")}</Alert>
        )}
        <Button
          startIcon={<CropFree />}
          disabled={disabled}
          onClick={() => onView(message)}
        >
          {i18n.t("attachments.expand")}
        </Button>
        {caption}
      </>
    );
  return (
    <>
      <div className={local.card}>
        <Description fontSize="small" /> {fileName}
        <div>
          <Button disabled={disabled} onClick={() => onView(message)}>
            {i18n.t(
              kind === "pdf" ? "attachments.viewPdf" : "attachments.view"
            )}
          </Button>
        </div>
      </div>
      {caption}
    </>
  );
}
