import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { makeStyles } from "@material-ui/core/styles";
import ButtonBase from "@material-ui/core/ButtonBase";
import InsertDriveFileIcon from "@material-ui/icons/InsertDriveFile";

// Zap Komunick: what is about to be sent, shown above the send bar.
//
// THE PREVIEW GIVES WAY, THE SEND BAR DOES NOT. On a low window (a notebook
// with the browser zoomed in, a phone lying down) there is not room for the
// conversation, a 42vh picture and the bar. The picture area therefore
// shrinks, down to `MIN_STAGE`, before anything else is pushed out of the
// screen; the picture is fitted inside whatever area it gets. When not even
// that fits, the preview scrolls INSIDE ITSELF: nothing of it may spill over
// the send bar below, which would cover the thumbnails and take their clicks.

// The smallest the picture area gets: still enough to tell which file it is.
export const MIN_STAGE = 48;
// Below this window height every pixel counts: the margins get tighter.
const LOW_WINDOW = "@media (max-height: 480px)";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "16px 16px 4px",
    // may shrink inside the composer when the window is low, and then scrolls
    flex: "0 1 auto",
    minHeight: 0,
    overflowY: "auto",
    [LOW_WINDOW]: { gap: 6, padding: "8px 16px 0" }
  },
  stage: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    // the height it would like; `flex-shrink` takes from it what is missing
    height: "min(360px, 42vh)",
    flex: "0 1 auto",
    minHeight: MIN_STAGE,
    color: theme.komunick.textSecondary
  },
  // Fitted inside the area by its own box: an absolutely placed box always
  // knows the size of the area, however the area got that size (a percentage
  // of a flexed height is not reliable in every browser).
  image: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    display: "block",
    margin: "auto",
    maxWidth: "100%",
    maxHeight: "100%",
    borderRadius: 8
  },
  fileIcon: { fontSize: 72, maxHeight: "100%" },
  strip: {
    display: "flex",
    flex: "none",
    maxWidth: "100%",
    gap: 8,
    padding: 2,
    overflowX: "auto"
  },
  thumb: {
    flex: "none",
    width: 56,
    height: 56,
    overflow: "hidden",
    borderRadius: 8,
    border: `2px solid ${theme.komunick.composerBorder}`,
    color: theme.komunick.textSecondary,
    "&:focus-visible": { borderColor: theme.komunick.text }
  },
  thumbSelected: { borderColor: theme.komunick.accent },
  thumbImage: { width: "100%", height: "100%", objectFit: "cover" }
}));

export const isImageFile = file => /^image\//.test(file?.type || "");

const FilePreview = ({ file, className, iconClassName }) => {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!isImageFile(file)) {
      setUrl(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // formats the browser cannot draw (HEIC, for instance) keep the file icon
  if (!isImageFile(file) || failed)
    return <InsertDriveFileIcon className={iconClassName} />;
  if (!url) return null;
  return (
    <img
      className={className}
      src={url}
      alt={file.name}
      onError={() => setFailed(true)}
    />
  );
};

const MediaSendPreview = ({ files, selected, onSelect }) => {
  const classes = useStyles();
  if (!files.some(isImageFile)) return null;

  return (
    <div className={classes.root} data-testid="media-send-preview">
      <div className={classes.stage} data-testid="media-send-stage">
        <FilePreview
          file={files[selected]}
          className={classes.image}
          iconClassName={classes.fileIcon}
        />
      </div>
      {files.length > 1 && (
        <div className={classes.strip}>
          {files.map((file, index) => (
            <ButtonBase
              key={`${index}:${file.name}`}
              className={clsx(classes.thumb, {
                [classes.thumbSelected]: index === selected
              })}
              aria-label={file.name}
              aria-pressed={index === selected}
              title={file.name}
              onClick={() => onSelect(index)}
            >
              <FilePreview file={file} className={classes.thumbImage} />
            </ButtonBase>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaSendPreview;
