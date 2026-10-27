import React, { useState, useEffect, useContext } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import { Colorize } from "@material-ui/icons";
import { ColorBox } from "material-ui-color";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import QueueSelect from "../QueueSelect";
import {
  IconButton,
  InputAdornment,
  FormControl,
  FormControlLabel,
  Switch,
  Typography
} from "@material-ui/core";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexWrap: "wrap"
  },
  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1)
    }
  },

  btnWrapper: {
    position: "relative"
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120
  },
  colorAdorment: {
    width: 20,
    height: 20
  },
  multFieldLine: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center"
  }
}));

const TagSchema = Yup.object().shape({
  name: Yup.string().min(3, "Mensagem muito curta").required("Obrigatório")
});

const TagModal = ({ open, onClose, tagId, reload, kanban }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [colorPickerModalOpen, setColorPickerModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  //console.log(user);

  const initialState = {
    name: "",
    color: "",
    kanban: kanban || 0,
    queueIds: []
  };

  const [tag, setTag] = useState(initialState);

  useEffect(() => {
    try {
      (async () => {
        if (!tagId) return;

        const { data } = await api.get(`/tags/${tagId}`);
        //console.log(data);
        setTag(prevState => {
          return { ...prevState, ...data, queueIds: data.queueIds || [] };
        });
      })();
    } catch (err) {
      toastError(err);
    }
  }, [tagId, open]);

  const handleClose = () => {
    setTag(initialState);
    setColorPickerModalOpen(false);
    onClose();
  };

  const handleSaveTag = async values => {
    setSaving(true);
    const tagData = {
      ...values,
      userId: user.id,
      kanban: values.kanban ? 1 : 0,
      // Zap Komunick: no sector means every sector (RF-019)
      queueIds: values.queueIds?.length ? values.queueIds : null
    };
    try {
      if (tagId) {
        await api.put(`/tags/${tagId}`, tagData);
      } else {
        await api.post("/tags", tagData);
      }
      toast.success(
        tagData.kanban === 0
          ? `${i18n.t("tagModal.success")}`
          : `${i18n.t("tagModal.successKanban")}`
      );
      if (typeof reload == "function") {
        reload();
      }
      handleClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={saving ? undefined : handleClose}
        maxWidth="xs"
        fullWidth
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">
          {tagId
            ? kanban === 0
              ? `${i18n.t("tagModal.title.edit")}`
              : `${i18n.t("tagModal.title.editKanban")}`
            : kanban === 0
              ? `${i18n.t("tagModal.title.add")}`
              : `${i18n.t("tagModal.title.addKanban")}`}
        </DialogTitle>
        <Formik
          initialValues={tag}
          enableReinitialize={true}
          validationSchema={TagSchema}
          onSubmit={async (values, actions) => {
            await handleSaveTag(values);
            actions.setSubmitting(false);
          }}
        >
          {({ touched, errors, isSubmitting, values, setFieldValue }) => (
            <Form>
              <DialogContent dividers>
                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    label={i18n.t("tagModal.form.name")}
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </div>
                <br />
                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    fullWidth
                    label={i18n.t("tagModal.form.color")}
                    name="color"
                    id="color"
                    error={touched.color && Boolean(errors.color)}
                    helperText={touched.color && errors.color}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <div
                            style={{ backgroundColor: values.color }}
                            className={classes.colorAdorment}
                          ></div>
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <IconButton
                          size="small"
                          color="default"
                          onClick={() =>
                            setColorPickerModalOpen(!colorPickerModalOpen)
                          }
                        >
                          <Colorize />
                        </IconButton>
                      )
                    }}
                    variant="outlined"
                    margin="dense"
                  />
                </div>

                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      checked={!!values.kanban}
                      onChange={e => {
                        const value = e.target.checked ? 1 : 0;
                        setFieldValue("kanban", value);
                      }}
                    />
                  }
                  label={i18n.t("tagModal.form.kanban")}
                />

                <QueueSelect
                  selectedQueueIds={values.queueIds || []}
                  onChange={ids => setFieldValue("queueIds", ids)}
                />
                <Typography variant="caption" color="textSecondary">
                  {i18n.t("tagModal.form.queuesHelp")}
                </Typography>

                {colorPickerModalOpen && (
                  <div>
                    <ColorBox
                      disableAlpha={true}
                      hslGradient={false}
                      style={{ margin: "20px auto 0" }}
                      value={values.color}
                      onChange={val => {
                        setFieldValue("color", `#${val.hex}`);
                      }}
                    />
                  </div>
                )}
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("tagModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {tagId
                    ? `${i18n.t("tagModal.buttons.okEdit")}`
                    : `${i18n.t("tagModal.buttons.okAdd")}`}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default TagModal;
