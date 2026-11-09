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
import { capitalize } from "lodash";
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

const createInitialSchedule = () => ({
  body: "",
  contactId: "",
  ticketId: null,
  queueId: "",
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
});

const ScheduleModal = ({
  open,
  onClose,
  scheduleId,
  contactId,
  contactName,
  ticketId,
  ticketQueueId,
  ticketQueueName,
  cleanContact,
  reload
}) => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { companyId, profile, queues: userQueues } = user;
  const [schedule, setSchedule] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [queues, setQueues] = useState([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  useEffect(() => {
    if (!open) return;

    let active = true;
    setSchedule(null);
    setLoadFailed(false);

    const load = async () => {
      try {
        const { data } = scheduleId
          ? await api.get(`/schedules/${scheduleId}`)
          : {};
        const linkedTicketId = data?.ticketId || ticketId;
        const [{ data: contactList }, { data: queueList }] = await Promise.all([
          linkedTicketId
            ? { data: [] }
            : api.get("/contacts/list", { params: { companyId } }),
          !ticketId && profile === "admin"
            ? api.get("/queue")
            : { data: userQueues || [] }
        ]);
        if (!active) return;

        const defaultQueueId =
          !data && queueList.length === 1 ? queueList[0].id : "";
        const contactOptions = contactList.map(({ id, name }) => ({
          id,
          name
        }));
        if (
          !linkedTicketId &&
          data?.contact &&
          !contactOptions.some(({ id }) => id === data.contact.id)
        ) {
          contactOptions.push(data.contact);
        }
        setContacts(contactOptions);
        setQueues(queueList);
        setSchedule({
          ...createInitialSchedule(),
          ...data,
          contactId: data?.contactId ?? (contactId || ""),
          contactIds:
            !scheduleId && !linkedTicketId && contactId ? [contactId] : [],
          ticketId: linkedTicketId || null,
          queueId: linkedTicketId
            ? ((data ? data.queueId : ticketQueueId) ?? "")
            : (data?.queueId ?? defaultQueueId),
          ...(data && {
            sendAt: moment(data.sendAt).format("YYYY-MM-DDTHH:mm"),
            recurrence: data.recurrence || "none",
            recurrenceEndAt: data.recurrenceEndAt
              ? moment(data.recurrenceEndAt).format("YYYY-MM-DD")
              : ""
          })
        });
      } catch (err) {
        if (active) {
          toastError(err);
          setLoadFailed(true);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [
    scheduleId,
    contactId,
    open,
    companyId,
    profile,
    userQueues,
    ticketId,
    ticketQueueId
  ]);

  const handleClose = () => {
    onClose();
    setSchedule(null);
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  };

  const ticketLinked =
    Boolean(schedule?.ticketId) ||
    ["ticket", "ticket_queue"].includes(schedule?.routingMode);
  const queueRequired = schedule?.routingMode === "queue" || queues.length > 0;
  const findQueue = id => queues.find(queue => queue.id === id);

  const handleSaveSchedule = async values => {
    const [datePart, timePart] = values.sendAt.split("T");
    const [year, month, day] = datePart.split("-");
    const [hour, minute] = timePart.split(":");
    const second = "00";

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

    const { contactId: recipientId, contactIds, tagId, queueId } = values;
    const recipients = ticketLinked
      ? { contactId: recipientId, ticketId: values.ticketId }
      : scheduleId
        ? { contactId: recipientId }
        : { contactIds, tagId: tagId || null };
    const scheduleData = {
      ...recipients,
      body: values.body,
      saveMessage: values.saveMessage,
      sendAt: sendAtWithTimezone,
      recurrence: values.recurrence || "none",
      recurrenceEndAt,
      mediaPath: values.mediaPath,
      mediaName: values.mediaName,
      businessDaysOnly: values.businessDaysOnly,
      // Legacy ticket-linked schedules may not have a stored queue yet.
      ...(!scheduleId || !ticketLinked || queueId
        ? { queueId: queueId || null }
        : {})
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
      return;
    }
    handleClose();
  };

  const renderForm = () => {
    if (schedule) {
      return (
        <Formik
          initialValues={schedule}
          enableReinitialize
          validationSchema={ScheduleSchema}
          onSubmit={handleSaveSchedule}
        >
          {({ touched, errors, isSubmitting, values, setFieldValue }) => (
            <Form>
              <DialogContent dividers>
                {/* Zap Komunick: a new schedule can go to several contacts or a tag */}
                {ticketLinked ? (
                  <TextField
                    id="schedule-contact"
                    label={i18n.t("scheduleModal.form.contact")}
                    value={schedule.contact?.name || contactName || ""}
                    InputProps={{ readOnly: true }}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                ) : !scheduleId ? (
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
                        value={
                          contacts.find(({ id }) => id === values.contactId) ||
                          null
                        }
                        options={contacts}
                        onChange={(e, contact) => {
                          setFieldValue("contactId", contact?.id || "");
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
                            label={i18n.t("scheduleModal.form.contact")}
                          />
                        )}
                      />
                    </FormControl>
                  </div>
                )}
                {ticketLinked || queues.length === 0 ? (
                  <TextField
                    id="schedule-queue"
                    label={i18n.t("common.queue")}
                    value={
                      values.queueId
                        ? ticketQueueName ||
                          schedule.queue?.name ||
                          findQueue(values.queueId)?.name ||
                          i18n.t("scheduleExtras.queueUnavailable")
                        : schedule.routingMode === "queue" ||
                            schedule.routingMode === "ticket_queue"
                          ? i18n.t("scheduleExtras.queueUnavailable")
                          : ticketLinked && scheduleId && !schedule.routingMode
                            ? i18n.t("scheduleExtras.ticketQueue")
                            : i18n.t("scheduleExtras.noQueue")
                    }
                    helperText={
                      ticketLinked
                        ? i18n.t(
                            schedule.ticketId
                              ? "scheduleExtras.ticketRoute"
                              : "backendErrors.ERR_SCHEDULE_TICKET_CONTEXT"
                          )
                        : undefined
                    }
                    InputProps={{ readOnly: true }}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                ) : (
                  <TextField
                    id="schedule-queue"
                    select
                    required
                    label={i18n.t("common.queue")}
                    value={values.queueId}
                    onChange={event =>
                      setFieldValue("queueId", event.target.value)
                    }
                    helperText={i18n.t("scheduleExtras.queueHelper")}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  >
                    {values.queueId && !findQueue(values.queueId) && (
                      <MenuItem value={values.queueId} disabled>
                        {i18n.t("scheduleExtras.queueUnavailable")}
                      </MenuItem>
                    )}
                    {queues.map(({ id, name }) => (
                      <MenuItem key={id} value={id}>
                        {name}
                      </MenuItem>
                    ))}
                  </TextField>
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
                    id="schedule-body"
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
                    disabled={
                      isSubmitting ||
                      (ticketLinked
                        ? !schedule.ticketId
                        : (queueRequired || Boolean(values.queueId)) &&
                          !findQueue(values.queueId))
                    }
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
      );
    }

    return (
      <>
        <DialogContent dividers>
          {loadFailed ? (
            i18n.t("scheduleExtras.loadFailed")
          ) : (
            <CircularProgress size={24} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="secondary" variant="outlined">
            {i18n.t("scheduleModal.buttons.cancel")}
          </Button>
        </DialogActions>
      </>
    );
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        scroll="paper"
        aria-labelledby="schedule-dialog-title"
      >
        <DialogTitle id="schedule-dialog-title">
          {!scheduleId
            ? i18n.t("scheduleModal.title.add")
            : !schedule
              ? i18n.t("scheduleModal.title.edit")
              : schedule.status === "ERRO"
                ? "Erro de Envio"
                : `Mensagem ${capitalize(schedule.status)}`}
        </DialogTitle>
        {renderForm()}
      </Dialog>
    </div>
  );
};

export default ScheduleModal;
