import React, { useEffect, useRef, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Button from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import FormHelperText from "@material-ui/core/FormHelperText";
import CircularProgress from "@material-ui/core/CircularProgress";
import Autocomplete from "@material-ui/lab/Autocomplete";
import AttachFileIcon from "@material-ui/icons/AttachFile";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

// Zap Komunick: several recipients, attachment and business days on
// schedules (docs/PRD.md, RF-008)

const useStyles = makeStyles(theme => ({
  block: {
    width: "100%",
    marginTop: theme.spacing(0.5)
  },
  tagOption: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  tagDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flex: "none"
  },
  attachment: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1)
  },
  hiddenInput: {
    display: "none"
  }
}));

export const ScheduleRecipients = ({
  contacts,
  contactIds,
  tagId,
  onChange,
  error
}) => {
  const classes = useStyles();
  const [tags, setTags] = useState([]);

  useEffect(() => {
    api
      .get("/tags/list")
      .then(({ data }) => setTags(Array.isArray(data) ? data : []))
      .catch(toastError);
  }, []);

  const options = contacts.filter(contact => contact.id);
  const selected = options.filter(contact => contactIds.includes(contact.id));

  return (
    <div className={classes.block}>
      <Autocomplete
        multiple
        fullWidth
        options={options}
        value={selected}
        filterSelectedOptions
        getOptionLabel={option => option.name || ""}
        getOptionSelected={(option, value) => option.id === value.id}
        onChange={(e, value) =>
          onChange({ contactIds: value.map(contact => contact.id), tagId })
        }
        renderInput={params => (
          <TextField
            {...params}
            variant="outlined"
            margin="dense"
            label={i18n.t("scheduleExtras.contacts")}
            error={Boolean(error)}
          />
        )}
      />
      <TextField
        select
        fullWidth
        variant="outlined"
        margin="dense"
        label={i18n.t("scheduleExtras.tag")}
        value={tagId || ""}
        onChange={e => onChange({ contactIds, tagId: e.target.value })}
        error={Boolean(error)}
      >
        <MenuItem value="">{i18n.t("scheduleExtras.noTag")}</MenuItem>
        {tags.map(tag => (
          <MenuItem key={tag.id} value={tag.id}>
            <span className={classes.tagOption}>
              <span
                className={classes.tagDot}
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </span>
          </MenuItem>
        ))}
      </TextField>
      <FormHelperText error={Boolean(error)}>
        {error
          ? i18n.t("scheduleExtras.required")
          : i18n.t("scheduleExtras.recipientsHelper")}
      </FormHelperText>
    </div>
  );
};

export const ScheduleBusinessDays = ({ checked, onChange, disabled }) => {
  const classes = useStyles();
  return (
    <div className={classes.block}>
      <FormControlLabel
        label={i18n.t("scheduleExtras.businessDays")}
        labelPlacement="end"
        control={
          <Switch
            size="small"
            color="primary"
            checked={!!checked}
            disabled={disabled}
            onChange={() => onChange(!checked)}
            name="businessDaysOnly"
          />
        }
      />
      <FormHelperText>
        {i18n.t("scheduleExtras.businessDaysHelper")}
      </FormHelperText>
    </div>
  );
};

export const ScheduleAttachment = ({
  mediaPath,
  mediaName,
  onChange,
  disabled
}) => {
  const classes = useStyles();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/schedules/media", formData);
      onChange({ mediaPath: data.mediaPath, mediaName: data.mediaName });
    } catch (err) {
      toastError(err);
    }
    setUploading(false);
  };

  return (
    <div className={classes.attachment}>
      <input
        ref={inputRef}
        type="file"
        className={classes.hiddenInput}
        onChange={handleFile}
      />
      {mediaPath ? (
        <Chip
          icon={<AttachFileIcon />}
          label={mediaName || mediaPath.split("/").pop()}
          onDelete={
            disabled
              ? undefined
              : () => onChange({ mediaPath: null, mediaName: null })
          }
          variant="outlined"
        />
      ) : (
        <Button
          size="small"
          variant="outlined"
          startIcon={
            uploading ? <CircularProgress size={14} /> : <AttachFileIcon />
          }
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading
            ? i18n.t("scheduleExtras.attaching")
            : i18n.t("scheduleExtras.attach")}
        </Button>
      )}
      <FormHelperText>
        {i18n.t("scheduleExtras.attachmentHelper")}
      </FormHelperText>
    </div>
  );
};
