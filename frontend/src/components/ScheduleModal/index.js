import React, { useState, useEffect, useContext } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  FormControl,
  FormControlLabel,
  Switch,
  MenuItem
} from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import moment from "moment";
import { AuthContext } from "../../context/Auth/AuthContext";
import { isArray, capitalize } from "lodash";
import { timeZonesNames } from "@vvo/tzdb";
import {
  ScheduleAttachment,
  ScheduleBusinessDays,
  ScheduleRecipients
} from "../ScheduleExtras";

const ALL_TIMEZONES = timeZonesNames.map(tz => ({
  value: tz,
  label: tz.replace(/_/g, " ")
}));

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
  }
}));

const ScheduleSchema = Yup.object().shape({
  body: Yup.string().min(5, "Mensagem muito curta").required("Obrigatório"),
  // Zap Komunick: or several contacts, or a tag (docs/PRD.md, RF-008)
  contactId: Yup.mixed().test("recipients", "Obrigatório", function (value) {
    const { contactIds, tagId } = this.parent;
    return Boolean(value) || contactIds?.length > 0 || Boolean(tagId);
  }),
  sendAt: Yup.string().required("Obrigatório"),
  saveMessage: Yup.bool()
});

const ScheduleModal = ({
  open,
  onClose,
  scheduleId,
  contactId,
  cleanContact,
  reload
}) => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);

  const initialState = {
    body: "",
    contactId: "",
    sendAt: moment().add(1, "hour").format("YYYY-MM-DDTHH:mm"),
    sentAt: "",
    saveMessage: false,
    recurrence: "none",
    recurrenceEndAt: "",
    contactIds: [],
    tagId: "",
    mediaPath: null,
    mediaName: null,
    businessDaysOnly: false
  };

  const initialContact = {
    id: "",
    name: ""
  };

  const [schedule, setSchedule] = useState(initialState);
  const [currentContact, setCurrentContact] = useState(initialContact);
  const [contacts, setContacts] = useState([initialContact]);
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  useEffect(() => {
    if (contactId && contacts.length) {
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        setCurrentContact(contact);
      }
    }
  }, [contactId, contacts]);

  useEffect(() => {
    const { companyId } = user;
    if (open) {
      try {
        (async () => {
          const { data: contactList } = await api.get("/contacts/list", {
            params: { companyId: companyId }
          });
          let customList = contactList.map(c => ({ id: c.id, name: c.name }));
          if (isArray(customList)) {
            setContacts([{ id: "", name: "" }, ...customList]);
          }
          if (contactId) {
            setSchedule(prevState => {
              return { ...prevState, contactId, contactIds: [contactId] };
            });
          }

          if (!scheduleId) return;

          const { data } = await api.get(`/schedules/${scheduleId}`);
          setSchedule(prevState => {
            return {
              ...prevState,
              ...data,
              sendAt: moment(data.sendAt).format("YYYY-MM-DDTHH:mm"),
              recurrence: data.recurrence || "none",
              recurrenceEndAt: data.recurrenceEndAt
                ? moment(data.recurrenceEndAt).format("YYYY-MM-DD")
                : ""
            };
          });
          setCurrentContact(data.contact);
        })();
      } catch (err) {
        toastError(err);
      }
    }
  }, [scheduleId, contactId, open, user]);

  const handleClose = () => {
    onClose();
    setSchedule(initialState);
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  };

  const handleSaveSchedule = async values => {
    const [datePart, timePart] = values.sendAt.split("T");
    const [year, month, day] = datePart.split("-");
    const [hour, minute] = timePart.split(":");
    const second = "00";

    const naiveDate = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0
    );

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });

    const utcDate = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        0
      )
    );

    const tzParts = formatter.formatToParts(utcDate);
    const get = type => tzParts.find(p => p.type === type)?.value || "00";
    const tzYear = get("year");
    const tzMonth = get("month");
    const tzDay = get("day");
    const tzHour = get("hour") === "24" ? "00" : get("hour");
    const tzMinute = get("minute");

    const tzDate = new Date(
      Date.UTC(
        Number(tzYear),
        Number(tzMonth) - 1,
        Number(tzDay),
        Number(tzHour),
        Number(tzMinute),
        0
      )
    );

    const offsetMs = tzDate.getTime() - utcDate.getTime();
    const offsetMinutes = Math.round(offsetMs / 60000);
    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60))
      .toString()
      .padStart(2, "0");
    const offsetMins = Math.abs(offsetMinutes % 60)
      .toString()
      .padStart(2, "0");
    const offsetSign = offsetMinutes >= 0 ? "+" : "-";

    const sendAtWithTimezone = `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetSign}${offsetHours}:${offsetMins}`;

    // Zap Komunick: recurrence (docs/PRD.md, RF-006); the end date counts
    // until the end of that day
    const recurrenceEndAt =
      values.recurrence !== "none" && values.recurrenceEndAt
        ? `${values.recurrenceEndAt}T23:59:59${offsetSign}${offsetHours}:${offsetMins}`
        : null;

    const { contactIds, tagId, ...rest } = values;
    const scheduleData = {
      ...rest,
      userId: user.id,
      sendAt: sendAtWithTimezone,
      recurrence: values.recurrence || "none",
      recurrenceEndAt,
      // Zap Komunick: recipients of a new schedule (docs/PRD.md, RF-008)
      ...(scheduleId
        ? {}
        : { contactId: undefined, contactIds, tagId: tagId || null })
    };
    try {
      if (scheduleId) {
        await api.put(`/schedules/${scheduleId}`, scheduleData);
        toast.success(i18n.t("scheduleModal.success"));
      } else {
        const { data } = await api.post("/schedules", scheduleData);
        toast.success(
          Array.isArray(data) && data.length > 1
            ? i18n.t("scheduleExtras.created", { count: data.length })
            : i18n.t("scheduleModal.success")
        );
      }
      if (typeof reload == "function") {
        reload();
      }
      if (contactId) {
        if (typeof cleanContact === "function") {
          cleanContact();
          history.push("/schedules");
        }
      }
    } catch (err) {
      toastError(err);
    }
    setCurrentContact(initialContact);
    setSchedule(initialState);
    handleClose();
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">
          {!scheduleId
            ? i18n.t("scheduleModal.title.add")
            : schedule.status === "ERRO"
            ? "Erro de Envio"
            : `Mensagem ${capitalize(schedule.status)}`}
        </DialogTitle>
        <Formik
          initialValues={schedule}
          enableReinitialize={true}
          validationSchema={ScheduleSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveSchedule(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting, values, setFieldValue }) => (
            <Form>
              <DialogContent dividers>
                {/* Zap Komunick: a new schedule can go to several contacts or a tag */}
                {!scheduleId ? (
                  <ScheduleRecipients
                    contacts={contacts}
                    contactIds={values.contactIds || []}
                    tagId={values.tagId}
                    onChange={({ contactIds, tagId }) => {
                      setFieldValue("contactIds", contactIds);
                      setFieldValue("contactId", contactIds[0] || "");
                      setFieldValue("tagId", tagId);
                    }}
                    error={touched.contactId && errors.contactId}
                  />
                ) : (
                  <div className={classes.multFieldLine}>
                    <FormControl fullWidth>
                      <Autocomplete
                        fullWidth
                        value={currentContact}
                        options={contacts}
                        onChange={(e, contact) => {
                          const contactId = contact ? contact.id : "";
                          setFieldValue("contactId", contactId);
                          setCurrentContact(contact ? contact : initialContact);
                        }}
                        getOptionLabel={option => option.name}
                        getOptionSelected={(option, value) => {
                          return value.id === option.id;
                        }}
                        renderInput={params => (
                          <TextField
                            variant="outlined"
                            margin="dense"
                            {...params}
                            placeholder="Contato"
                          />
                        )}
                      />
                    </FormControl>
                  </div>
                )}
                <div className={classes.multFieldLine}>
                  <FormControlLabel
                    label={i18n.t("scheduleModal.form.saveMessage")}
                    labelPlacement="end"
                    control={
                      <Switch
                        size="small"
                        checked={values.saveMessage}
                        onChange={() =>
                          setFieldValue("saveMessage", !values.saveMessage)
                        }
                        name="saveMessage"
                        color="primary"
                      />
                    }
                  />
                </div>
                <ScheduleBusinessDays
                  checked={values.businessDaysOnly}
                  onChange={checked =>
                    setFieldValue("businessDaysOnly", checked)
                  }
                />
                <div className={classes.multFieldLine}>
                  <Field
                    variant="outlined"
                    margin="dense"
                    as={TextField}
                    label={i18n.t("scheduleModal.form.sendAt")}
                    type="datetime-local"
                    name="sendAt"
                    InputLabelProps={{
                      shrink: true
                    }}
                    error={touched.sendAt && Boolean(errors.sendAt)}
                    helperText={touched.sendAt && errors.sendAt}
                    fullWidth
                  />
                </div>
                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    select
                    variant="outlined"
                    margin="dense"
                    label={i18n.t("recurrence.label")}
                    name="recurrence"
                    fullWidth
                  >
                    {["none", "daily", "weekly", "monthly", "yearly"].map(
                      option => (
                        <MenuItem key={option} value={option}>
                          {i18n.t(`recurrence.options.${option}`)}
                        </MenuItem>
                      )
                    )}
                  </Field>
                  {values.recurrence && values.recurrence !== "none" && (
                    <Field
                      as={TextField}
                      variant="outlined"
                      margin="dense"
                      type="date"
                      label={i18n.t("recurrence.endAt")}
                      name="recurrenceEndAt"
                      InputLabelProps={{ shrink: true }}
                      helperText={i18n.t("recurrence.endAtHelper")}
                      fullWidth
                    />
                  )}
                </div>
                <div className={classes.multFieldLine}>
                  <FormControl variant="outlined" margin="dense" fullWidth>
                    <Autocomplete
                      value={
                        ALL_TIMEZONES.find(tz => tz.value === timezone) || null
                      }
                      onChange={(event, newValue) => {
                        if (newValue) {
                          setTimezone(newValue.value);
                        }
                      }}
                      options={ALL_TIMEZONES}
                      getOptionLabel={option => option.label}
                      renderInput={params => (
                        <TextField
                          {...params}
                          label={i18n.t("openHours.timezone.placeholder")}
                          variant="outlined"
                          margin="dense"
                          placeholder={i18n.t(
                            "openHours.timezone.searchPlaceholder"
                          )}
                        />
                      )}
                      fullWidth
                    />
                  </FormControl>
                </div>
                <div className={classes.multFieldLine}>
                  <Field
                    variant="outlined"
                    margin="dense"
                    as={TextField}
                    name="body"
                    rows={9}
                    multiline={true}
                    label={i18n.t("scheduleModal.form.body")}
                    error={touched.body && Boolean(errors.body)}
                    helperText={touched.body && errors.body}
                    fullWidth
                  />
                </div>
                <ScheduleAttachment
                  mediaPath={values.mediaPath}
                  mediaName={values.mediaName}
                  disabled={Boolean(schedule.sentAt)}
                  onChange={({ mediaPath, mediaName }) => {
                    setFieldValue("mediaPath", mediaPath);
                    setFieldValue("mediaName", mediaName);
                  }}
                />
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("scheduleModal.buttons.cancel")}
                </Button>
                {(schedule.sentAt === null || schedule.sentAt === "") && (
                  <Button
                    type="submit"
                    color="primary"
                    disabled={isSubmitting}
                    variant="contained"
                    className={classes.btnWrapper}
                  >
                    {scheduleId
                      ? `${i18n.t("scheduleModal.buttons.okEdit")}`
                      : `${i18n.t("scheduleModal.buttons.okAdd")}`}
                    {isSubmitting && (
                      <CircularProgress
                        size={24}
                        className={classes.buttonProgress}
                      />
                    )}
                  </Button>
                )}
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default ScheduleModal;
