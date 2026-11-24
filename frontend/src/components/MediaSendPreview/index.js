import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { makeStyles } from "@material-ui/core/styles";
import ButtonBase from "@material-ui/core/ButtonBase";
import InsertDriveFileIcon from "@material-ui/icons/InsertDriveFile";

// Zap Komunick: what is about to be sent, shown above the send bar.

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "16px 16px 4px"
  },
  stage: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "min(360px, 42vh)",
    color: theme.komunick.textSecondary
  },
  image: {
    display: "block",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    borderRadius: 8
  },
  fileIcon: { fontSize: 72 },
  strip: {
    display: "flex",
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
    <div className={classes.root}>
      <div className={classes.stage}>
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
