import React from "react";
import { Chip } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import CancelIcon from "@material-ui/icons/Cancel";
import ImageOutlinedIcon from "@material-ui/icons/ImageOutlined";
import MovieOutlinedIcon from "@material-ui/icons/MovieOutlined";
import PictureAsPdfOutlinedIcon from "@material-ui/icons/PictureAsPdfOutlined";
import { i18n } from "../../translate/i18n";
import { attachmentKind, megabytes } from "../../helpers/supportTickets";

const useStyles = makeStyles(theme => ({
  files: { display: "flex", flexWrap: "wrap", gap: theme.spacing(0.75) },
  chip: { maxWidth: "100%" }
}));

export const kindIcon = mimeType => {
  const kind = attachmentKind(mimeType);
  if (kind === "pdf") return <PictureAsPdfOutlinedIcon />;
  if (kind === "video") return <MovieOutlinedIcon />;
  return <ImageOutlinedIcon />;
};

// Zap Komunick: files waiting to be sent, each with a button to take it out.
const DraftFiles = ({ files, onRemove, disabled }) => {
  const classes = useStyles();
  if (!files.length) return null;

  return (
    <div className={classes.files}>
      {files.map((file, index) => (
        <Chip
          key={`${file.name}-${index}`}
          className={classes.chip}
          size="small"
          variant="outlined"
          icon={kindIcon(file.type)}
          label={`${file.name} · ${megabytes(file.size)} MB`}
          onDelete={disabled ? undefined : () => onRemove(index)}
          deleteIcon={
            <CancelIcon
              role="button"
              aria-label={i18n.t("support.attachments.remove", {
                name: file.name
              })}
            />
          }
        />
      ))}
    </div>
  );
};

export default DraftFiles;
