import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  IconButton,
  Input,
  InputAdornment,
  makeStyles,
  Paper,
  Tooltip,
  Typography
} from "@material-ui/core";
import SendIcon from "@material-ui/icons/Send";

import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";
import api from "../../services/api";
import { getBackendURL } from "../../services/config";
import {
  chatMediaPath,
  chatMediaPreview,
  chatMediaUrl,
  releaseChatMedia
} from "../../helpers/chatMedia";
import { i18n } from "../../translate/i18n";

import AttachFileIcon from "@material-ui/icons/AttachFile";
import CancelIcon from "@material-ui/icons/Cancel";
import CircularProgress from "@material-ui/core/CircularProgress";
import { GetApp } from "@material-ui/icons";
import toastError from "../../errors/toastError";
import MicRecorder from "mic-recorder-to-mp3";
import MicIcon from "@material-ui/icons/Mic";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import PauseIcon from "@material-ui/icons/Pause";
import CropFreeIcon from "@material-ui/icons/CropFree";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import RecordingTimer from "../../components/MessageInputCustom/RecordingTimer";
import MediaGalleryLightbox, {
  buildMediaGalleryData
} from "../../components/MediaGalleryLightbox";

const previewCandidate = message =>
  message?.mediaPath && ["image", "audio", "video"].includes(message.mediaType);
const previewKey = (scope, message) =>
  [
    scope,
    message.id,
    message.mediaPath,
    message.mediaType,
    message.updatedAt
  ].join("|");

const useStyles = makeStyles(theme => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    overflow: "hidden",
    borderRadius: 0,
    height: "100%",
    boxShadow: "none"
  },
  messageList: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
    padding: "12px 0",
    ...theme.scrollbarStyles,
    backgroundColor: theme.komunick.chatBackground
  },
  inputArea: {
    position: "relative",
    height: "auto",
    paddingTop: 8,
    backgroundColor: theme.komunick.chatBackground
  },
  status: {
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    color: theme.komunick.textSecondary,
    textAlign: "center"
  },
  emptyHistory: {
    margin: "auto",
    padding: 24,
    textAlign: "center",
    color: theme.komunick.textSecondary
  },
  composerHint: {
    padding: "0 20px 8px",
    fontSize: 11,
    color: theme.komunick.textSecondary
  },
  input: {
    display: "flex",
    // Zap Komunick: same composer as the tickets, a rounded bar in its own
    // tone over the conversation background
    margin: "0 12px 10px",
    width: "calc(100% - 24px)",
    padding: "4px 6px",
    borderRadius: 26,
    border: `1px solid ${theme.komunick.composerBorder}`,
    backgroundColor: theme.komunick.composer,
    boxShadow: theme.komunick.composerShadow,
    "&:focus-within": {
      borderColor: theme.komunick.accent
    },
    "&:before, &:after": { display: "none" }
  },
  buttonSend: {
    margin: theme.spacing(1)
  },
  boxLeft: {
    padding: "10px 10px 5px",
    margin: "10px",
    position: "relative",
    alignSelf: "flex-start",
    maxWidth: "min(600px, calc(100% - 32px))",
    borderRadius: 10,
    borderBottomLeftRadius: 0,
    border: `1px solid ${theme.komunick.border}`,
    boxShadow: theme.komunick.shadow,
    color: theme.komunick.text,
    backgroundColor: theme.komunick.bubbleTheirs,
    overflowWrap: "anywhere",
    minWidth: 0
  },
  boxRight: {
    padding: "10px 10px 5px",
    margin: "10px 10px 10px auto",
    position: "relative",
    alignSelf: "flex-end",
    maxWidth: "min(600px, calc(100% - 32px))",
    borderRadius: 10,
    borderBottomRightRadius: 0,
    border: `1px solid ${theme.komunick.bubbleMineBorder}`,
    boxShadow: theme.komunick.shadow,
    color: theme.komunick.text,
    backgroundColor: theme.komunick.bubbleMine,
    overflowWrap: "anywhere",
    minWidth: 0
  },
  messageBody: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  messageTime: {
    marginTop: 5,
    fontSize: 11,
    textAlign: "right",
    color: theme.komunick.textSecondary
  },
  sendMessageIcons: {
    color: theme.komunick.textSecondary
  },
  uploadInput: {
    display: "none"
  },
  viewMediaInputWrapper: {
    display: "flex",
    padding: "10px 13px",
    position: "relative",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.komunick.composer,
    color: theme.komunick.text,
    borderTop: `1px solid ${theme.komunick.composerBorder}`
  },
  selectedFiles: { flex: 1, minWidth: 0, overflowWrap: "anywhere" },
  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10
  },
  messageMedia: {
    objectFit: "cover",
    width: 250,
    maxWidth: "100%",
    height: 200,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8
  },
  videoPreviewWrapper: {
    width: 250,
    maxWidth: "100%",
    height: 200,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000"
  },
  videoPreviewMedia: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block"
  },
  videoPreviewActions: {
    position: "absolute",
    right: 8,
    bottom: 8,
    display: "flex",
    gap: 8,
    zIndex: 1
  },
  videoPreviewActionButton: {
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    color: "#fff",
    "&:hover": {
      backgroundColor: "rgba(15, 23, 42, 0.82)"
    }
  },

  recorderWrapper: {
    display: "flex",
    alignItems: "center",
    alignContent: "middle",
    justifyContent: "flex-end"
  },

  cancelAudioIcon: {
    color: theme.palette.error.main
  },

  audioLoading: {
    color: theme.komunick.accent,
    opacity: "70%"
  },

  sendAudioIcon: {
    color: theme.komunick.accent
  }
}));

export default function ChatMessages({
  chat,
  messages,
  handleSendMessage,
  handleLoadMore,
  scrollToBottomRef,
  pageInfo,
  historyLoading = false,
  historyError = false,
  handleRetryMessages,
  handleMediaSent
}) {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { datetimeToClient } = useDate();
  const baseRef = useRef();
  const previewVideoRefs = useRef({});
  const mediaNodesRef = useRef(new Map());
  const downloadRequestRef = useRef(null);
  const previewRequestsRef = useRef(new Map());
  const sendingRef = useRef(false);
  const mountedRef = useRef(true);
  const inputRef = useRef();
  const recordingRef = useRef(false);
  const [recorder] = useState(() => new MicRecorder({ bitRate: 128 }));

  const [contentMessage, setContentMessage] = useState("");
  const [medias, setMedias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [recording, setRecording] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [previewVideoPlayingById, setPreviewVideoPlayingById] = useState({});
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [previews, setPreviews] = useState({});
  const previewScope = `${user.companyId}:${user.id}:${chat.id}`;

  useEffect(() => {
    const requests = previewRequestsRef.current;
    const activeKeys = new Set();
    messages.filter(previewCandidate).forEach(message => {
      const key = previewKey(previewScope, message);
      activeKeys.add(key);
      if (requests.has(key)) return;
      const path = chatMediaPath(chat.id, message.id);
      if (!path) return;
      const request = { controller: new AbortController() };
      requests.set(key, request);
      api
        .head(path, { signal: request.controller.signal, timeout: 30000 })
        .then(({ headers }) => {
          if (
            !mountedRef.current ||
            request.controller.signal.aborted ||
            requests.get(key) !== request
          )
            return;
          setPreviews(previous => ({
            ...previous,
            [key]: { decision: chatMediaPreview(headers) }
          }));
        })
        .catch(error => {
          if (
            !mountedRef.current ||
            request.controller.signal.aborted ||
            requests.get(key) !== request
          )
            return;
          setPreviews(previous => ({ ...previous, [key]: { decision: null } }));
          setMediaError(
            [401, 403, 404].includes(error?.response?.status)
              ? "attachments.access"
              : "attachments.failed"
          );
          setLightboxOpen(false);
        });
    });
    requests.forEach((request, key) => {
      if (!activeKeys.has(key)) {
        request.controller.abort();
        requests.delete(key);
      }
    });
    setPreviews(previous => {
      const entries = Object.entries(previous).filter(([key]) =>
        activeKeys.has(key)
      );
      return entries.length === Object.keys(previous).length
        ? previous
        : Object.fromEntries(entries);
    });
    // A pending HEAD belongs to its attachment key, not to the messages array.
    // Removed keys are cancelled above; unmount cancels all remaining requests.
  }, [messages, chat.id, previewScope]);

  const lightboxMedia = useMemo(() => {
    return buildMediaGalleryData(messages, {
      getMediaUrl: message =>
        message?.mediaPath &&
        previews[previewKey(previewScope, message)]?.decision
          ? chatMediaUrl(getBackendURL(), chat.id, message.id)
          : null,
      getMediaType: message =>
        previews[previewKey(previewScope, message)]?.decision?.kind,
      getFileName: message => message.mediaName || message.message
    });
  }, [messages, chat.id, previews, previewScope]);

  const openLightboxForMessage = messageId => {
    const index = lightboxMedia.byMessageId[messageId];
    if (index === undefined) {
      return;
    }

    setLightboxIndex(index);
    setMediaError("");
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const scrollToBottom = () => {
    if (baseRef.current) {
      baseRef.current.scrollIntoView({});
    }
  };

  useEffect(() => {
    scrollToBottomRef.current = scrollToBottom;
    const mediaNodes = mediaNodesRef.current;
    const previewRequests = previewRequestsRef.current;
    return () => {
      mountedRef.current = false;
      scrollToBottomRef.current = null;
      if (recordingRef.current) {
        recorder.stop();
        recordingRef.current = false;
      }
      const pendingDownload = downloadRequestRef.current;
      downloadRequestRef.current = null;
      if (pendingDownload) {
        pendingDownload.controller.abort();
        pendingDownload.close();
      }
      mediaNodes.forEach(entry => releaseChatMedia(entry.node));
      mediaNodes.clear();
      previewRequests.forEach(request => request.controller.abort());
      previewRequests.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = e => {
    const { scrollTop } = e.currentTarget;
    if (!pageInfo.hasMore || historyLoading || historyError) return;
    if (scrollTop < 600) {
      handleLoadMore();
    }
  };

  const handleChangeMedias = e => {
    if (!e.target.files) {
      return;
    }

    const selectedMedias = Array.from(e.target.files);
    setMedias(selectedMedias);
    setSendError(false);
    e.target.value = "";
  };

  // Zap Komunick: only a confirmed send clears the draft; one in-flight
  // operation owns this composer until it finishes or its chat unmounts.
  const sendText = async () => {
    if (sendingRef.current || !contentMessage.trim()) return;
    sendingRef.current = true;
    setLoading(true);
    setSendError(false);
    try {
      const sent = await handleSendMessage(contentMessage);
      if (mountedRef.current) {
        if (sent === false) setSendError(true);
        else setContentMessage("");
      }
    } catch {
      if (mountedRef.current) setSendError(true);
    } finally {
      sendingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
  };

  const handleVideoPreviewPlayClick = (event, messageId) => {
    event.stopPropagation();

    const previewVideo = previewVideoRefs.current[messageId];
    if (!previewVideo) {
      return;
    }

    if (previewVideo.paused) {
      previewVideo.play().catch(() => {});
      return;
    }

    previewVideo.pause();
  };

  const pausePreviewVideo = messageId => {
    const previewVideo = previewVideoRefs.current[messageId];
    if (!previewVideo) {
      return;
    }

    previewVideo.pause();
  };

  const captureMedia = (messageId, kind) => {
    const key = `${kind}:${messageId}`;
    if (!mediaNodesRef.current.has(key)) {
      const entry = { node: null };
      // Keep this callback stable across renders: replacing a ref must not
      // pause playback whenever its play/pause indicator updates.
      entry.ref = node => {
        if (entry.node === node) return;
        releaseChatMedia(entry.node);
        entry.node = node;
        if (kind === "video") {
          if (node) previewVideoRefs.current[messageId] = node;
          else delete previewVideoRefs.current[messageId];
        }
      };
      mediaNodesRef.current.set(key, entry);
    }
    return mediaNodesRef.current.get(key).ref;
  };

  const reportMediaError = () => {
    setMediaError("attachments.access");
    setLightboxOpen(false);
  };

  const downloadMedia = async messageId => {
    if (downloadRequestRef.current) return;
    const path = chatMediaPath(chat.id, messageId, true);
    const url = chatMediaUrl(getBackendURL(), chat.id, messageId, true);
    if (!path || !url) return reportMediaError();
    setMediaError("");
    let destination;
    try {
      // Reserve the user-initiated destination before the asynchronous HEAD.
      // A later denied GET stays outside the current chat and is never retried
      // against the old public link. The server authorizes that GET again.
      destination = window.open("about:blank", "_blank");
      if (destination) destination.opener = null;
    } catch {
      destination = null;
    }
    if (!destination) {
      setMediaError("chatPage.downloadBlocked");
      setLightboxOpen(false);
      return;
    }
    const request = {
      controller: new AbortController(),
      closed: false,
      close() {
        if (!this.closed) {
          this.closed = true;
          destination.close();
        }
      }
    };
    downloadRequestRef.current = request;
    setDownloadBusy(true);
    try {
      await api.head(path, {
        signal: request.controller.signal,
        timeout: 30000
      });
      if (
        !mountedRef.current ||
        request.controller.signal.aborted ||
        downloadRequestRef.current !== request ||
        destination.closed
      ) {
        request.close();
        return;
      }
      destination.location.replace(url);
    } catch (error) {
      request.close();
      if (mountedRef.current && !request.controller.signal.aborted) {
        setMediaError(
          [401, 403, 404].includes(error?.response?.status)
            ? "attachments.access"
            : "attachments.failed"
        );
        setLightboxOpen(false);
      }
    } finally {
      if (downloadRequestRef.current === request) {
        downloadRequestRef.current = null;
        if (mountedRef.current) setDownloadBusy(false);
      }
    }
  };

  const checkMessageMedia = message => {
    const mediaUrl = chatMediaUrl(getBackendURL(), chat.id, message.id);
    if (!mediaUrl)
      return (
        <Typography role="alert">{i18n.t("attachments.access")}</Typography>
      );

    const preview = previews[previewKey(previewScope, message)];
    if (previewCandidate(message) && !preview)
      return (
        <Typography variant="caption" role="status">
          {i18n.t("attachments.loading")}
        </Typography>
      );
    const kind = preview?.decision?.kind;
    if (kind === "image") {
      return (
        <img
          ref={captureMedia(message.id, "image")}
          className={classes.messageMedia}
          crossOrigin="use-credentials"
          src={mediaUrl}
          alt={i18n.t("chatPage.messageImage")}
          style={{ cursor: "pointer" }}
          onClick={() => openLightboxForMessage(message.id)}
          onError={reportMediaError}
        />
      );
    }
    if (kind === "audio") {
      return (
        <audio
          ref={captureMedia(message.id, "audio")}
          crossOrigin="use-credentials"
          controls
          style={{ maxWidth: "100%" }}
          onError={reportMediaError}
        >
          <source src={mediaUrl} type={preview.decision.mimeType}></source>
        </audio>
      );
    }

    if (kind === "video") {
      return (
        <div className={classes.videoPreviewWrapper}>
          <video
            ref={captureMedia(message.id, "video")}
            className={classes.videoPreviewMedia}
            crossOrigin="use-credentials"
            src={mediaUrl}
            onError={reportMediaError}
            preload="metadata"
            playsInline
            onPlay={() => {
              setPreviewVideoPlayingById(previous => ({
                ...previous,
                [message.id]: true
              }));
            }}
            onPause={() => {
              setPreviewVideoPlayingById(previous => ({
                ...previous,
                [message.id]: false
              }));
            }}
            onEnded={() => {
              setPreviewVideoPlayingById(previous => ({
                ...previous,
                [message.id]: false
              }));
            }}
          />
          <div className={classes.videoPreviewActions}>
            <IconButton
              className={classes.videoPreviewActionButton}
              aria-label={i18n.t(
                previewVideoPlayingById[message.id]
                  ? "chatPage.pauseVideo"
                  : "chatPage.playVideo"
              )}
              onClick={event => handleVideoPreviewPlayClick(event, message.id)}
            >
              {previewVideoPlayingById[message.id] ? (
                <PauseIcon />
              ) : (
                <PlayArrowIcon />
              )}
            </IconButton>
            <IconButton
              className={classes.videoPreviewActionButton}
              aria-label={i18n.t("chatPage.openMedia")}
              onClick={event => {
                event.stopPropagation();
                pausePreviewVideo(message.id);
                openLightboxForMessage(message.id);
              }}
            >
              <CropFreeIcon />
            </IconButton>
          </div>
        </div>
      );
    } else {
      return (
        <>
          <div className={classes.downloadMedia}>
            <Button
              startIcon={<GetApp />}
              color="primary"
              variant="outlined"
              disabled={downloadBusy}
              onClick={() => downloadMedia(message.id)}
            >
              {i18n.t("chatPage.download")}
            </Button>
          </div>
          {/* <Divider /> */}
        </>
      );
    }
  };

  const handleSendMedia = async e => {
    e.preventDefault();
    if (sendingRef.current || !medias.length) return;
    sendingRef.current = true;
    setLoading(true);
    setSendError(false);

    const formData = new FormData();
    formData.append("fromMe", true);
    medias.forEach(media => {
      formData.append("medias", media);
      formData.append("body", media.name);
    });

    let uploaded = false;
    try {
      await api.post(`/chats/${chat.id}/messages`, formData);
      uploaded = true;
      if (mountedRef.current) {
        setMedias([]);
      }
    } catch (err) {
      toastError(err);
      if (mountedRef.current) setSendError(true);
    } finally {
      sendingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
    // The parent handles a GET failure as history retry, never upload retry.
    if (uploaded && mountedRef.current) await handleMediaSent?.();
  };

  const handleStartRecording = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setLoading(true);
    setSendError(false);
    try {
      await recorder.start();
      if (!mountedRef.current) {
        recorder.stop();
        return;
      }
      recordingRef.current = true;
      setRecording(true);
    } catch (err) {
      if (mountedRef.current) toastError(err);
    } finally {
      sendingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleUploadAudio = async () => {
    if (sendingRef.current || !recordingRef.current) return;
    sendingRef.current = true;
    setLoading(true);
    let uploaded = false;
    let audioFile;
    try {
      recordingRef.current = false;
      const [, blob] = await recorder.stop().getMp3();
      if (!mountedRef.current || blob.size < 10000) return;

      const formData = new FormData();
      const filename = `audio-${new Date().getTime()}.mp3`;
      audioFile = new File([blob], filename, {
        type: blob.type || "audio/mpeg"
      });

      formData.append("medias", audioFile);
      formData.append("body", filename);
      formData.append("fromMe", true);

      await api.post(`/chats/${chat.id}/messages`, formData);
      uploaded = true;
    } catch (err) {
      if (mountedRef.current) {
        toastError(err);
        setSendError(true);
        if (audioFile) setMedias([audioFile]);
      }
    } finally {
      sendingRef.current = false;
      if (mountedRef.current) {
        setRecording(false);
        setLoading(false);
      }
    }
    if (uploaded && mountedRef.current) await handleMediaSent?.();
  };

  const handleCancelAudio = async () => {
    if (sendingRef.current || !recordingRef.current) return;
    sendingRef.current = true;
    try {
      recordingRef.current = false;
      await recorder.stop().getMp3();
    } catch (err) {
      if (mountedRef.current) toastError(err);
    } finally {
      sendingRef.current = false;
      if (mountedRef.current) setRecording(false);
    }
  };

  return (
    <Paper className={classes.mainContainer}>
      <div
        onScroll={handleScroll}
        className={classes.messageList}
        role="region"
        aria-label={i18n.t("chatPage.messages")}
        aria-busy={historyLoading}
      >
        {historyLoading && (
          <div className={classes.status} role="status">
            <CircularProgress size={18} />
            <Typography variant="body2">
              {i18n.t("chatPage.loadingMessages")}
            </Typography>
          </div>
        )}
        {historyError && (
          <div className={classes.status} role="alert">
            <Typography variant="body2">
              {i18n.t("chatPage.messagesError")}
            </Typography>
            <Button size="small" onClick={handleRetryMessages}>
              {i18n.t("chatPage.retry")}
            </Button>
          </div>
        )}
        {!historyLoading && !historyError && pageInfo.hasMore && (
          <div className={classes.status}>
            <Button size="small" onClick={handleLoadMore}>
              {i18n.t("chatPage.loadMore")}
            </Button>
          </div>
        )}
        {!historyLoading && !historyError && messages.length === 0 && (
          <div className={classes.emptyHistory}>
            <Typography variant="subtitle2">
              {i18n.t("chatPage.emptyMessages")}
            </Typography>
            <Typography variant="body2">
              {i18n.t("chatPage.emptyMessagesHint")}
            </Typography>
          </div>
        )}
        {messages.map(item => (
          <Box
            key={item.id}
            className={
              item.senderId === user.id ? classes.boxRight : classes.boxLeft
            }
          >
            <Typography variant="subtitle2">
              {item.sender?.name || i18n.t("chatPage.unknownSender")}
            </Typography>
            {item.mediaPath && checkMessageMedia(item)}
            <Typography
              component="div"
              variant="body2"
              className={classes.messageBody}
            >
              {item.message}
            </Typography>
            <Typography
              variant="caption"
              display="block"
              className={classes.messageTime}
            >
              {datetimeToClient(item.createdAt)}
            </Typography>
          </Box>
        ))}
        <div ref={baseRef}></div>
      </div>
      {mediaError && (
        <div className={classes.status} role="alert">
          <Typography variant="body2">{i18n.t(mediaError)}</Typography>
        </div>
      )}
      <div className={classes.inputArea}>
        <FormControl variant="outlined" fullWidth>
          {recording ? (
            <div className={classes.recorderWrapper}>
              <IconButton
                aria-label={i18n.t("chatPage.cancelRecording")}
                fontSize="large"
                disabled={loading}
                onClick={handleCancelAudio}
              >
                <HighlightOffIcon className={classes.cancelAudioIcon} />
              </IconButton>
              {loading ? (
                <div>
                  <CircularProgress className={classes.audioLoading} />
                </div>
              ) : (
                <RecordingTimer />
              )}

              <IconButton
                aria-label={i18n.t("chatPage.sendRecording")}
                onClick={handleUploadAudio}
                disabled={loading}
              >
                <CheckCircleOutlineIcon className={classes.sendAudioIcon} />
              </IconButton>
            </div>
          ) : (
            <>
              {medias.length > 0 ? (
                <>
                  <Paper
                    elevation={0}
                    square
                    className={classes.viewMediaInputWrapper}
                  >
                    <IconButton
                      aria-label={i18n.t("chatPage.cancelFiles")}
                      disabled={loading}
                      onClick={() => {
                        setMedias([]);
                        setSendError(false);
                      }}
                    >
                      <CancelIcon className={classes.sendMessageIcons} />
                    </IconButton>

                    <div className={classes.selectedFiles}>
                      {medias.map(media => (
                        <Typography
                          variant="body2"
                          key={media.name + media.size}
                        >
                          {media.name}
                        </Typography>
                      ))}
                    </div>
                    <IconButton
                      aria-label={i18n.t("chatPage.sendFiles")}
                      onClick={handleSendMedia}
                      disabled={loading}
                    >
                      {loading ? (
                        <CircularProgress size={20} />
                      ) : (
                        <SendIcon className={classes.sendMessageIcons} />
                      )}
                    </IconButton>
                  </Paper>
                </>
              ) : (
                <React.Fragment>
                  <Input
                    multiline
                    rowsMax={5}
                    inputRef={inputRef}
                    disabled={loading}
                    inputProps={{
                      "aria-label": i18n.t("chatPage.messageInput"),
                      "aria-describedby": "internal-chat-input-hint"
                    }}
                    placeholder={i18n.t("messagesInput.placeholderOpen")}
                    value={contentMessage}
                    onKeyDown={e => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing &&
                        e.keyCode !== 229
                      ) {
                        e.preventDefault();
                        sendText();
                      }
                    }}
                    onChange={e => setContentMessage(e.target.value)}
                    className={classes.input}
                    startAdornment={
                      <InputAdornment position="start">
                        <FileInput
                          disableOption={loading}
                          handleChangeMedias={handleChangeMedias}
                        />
                      </InputAdornment>
                    }
                    endAdornment={
                      <InputAdornment position="end">
                        {contentMessage ? (
                          <IconButton
                            aria-label={i18n.t("chatPage.send")}
                            onClick={sendText}
                            disabled={loading || !contentMessage.trim()}
                            className={classes.buttonSend}
                          >
                            {loading ? (
                              <CircularProgress size={20} />
                            ) : (
                              <SendIcon />
                            )}
                          </IconButton>
                        ) : (
                          <IconButton
                            aria-label={i18n.t("chatPage.recordAudio")}
                            disabled={loading}
                            onClick={handleStartRecording}
                          >
                            <MicIcon className={classes.sendMessageIcons} />
                          </IconButton>
                        )}
                      </InputAdornment>
                    }
                  />
                </React.Fragment>
              )}
            </>
          )}
        </FormControl>
        {sendError && (
          <div className={classes.status} role="alert">
            <Typography variant="body2">
              {i18n.t("chatPage.sendError")}
            </Typography>
          </div>
        )}
        {!recording && medias.length === 0 && (
          <Typography
            id="internal-chat-input-hint"
            className={classes.composerHint}
          >
            {i18n.t(loading ? "chatPage.sending" : "chatPage.composerHint")}
          </Typography>
        )}
      </div>
      <MediaGalleryLightbox
        open={lightboxOpen}
        onClose={closeLightbox}
        index={lightboxIndex}
        slides={lightboxMedia.slides}
        privateMedia
        crossOrigin="use-credentials"
        onDownload={slide => downloadMedia(slide.key)}
        onMediaError={reportMediaError}
      />
    </Paper>
  );
}

const FileInput = props => {
  const { handleChangeMedias, disableOption } = props;
  const classes = useStyles();
  const inputRef = useRef();
  return (
    <>
      <input
        multiple
        type="file"
        ref={inputRef}
        aria-label={i18n.t("chatPage.attachFiles")}
        disabled={disableOption}
        className={classes.uploadInput}
        onChange={handleChangeMedias}
      />
      <Tooltip title={i18n.t("chatPage.attachFiles")}>
        <IconButton
          aria-label={i18n.t("chatPage.attachFiles")}
          onClick={() => inputRef.current?.click()}
          disabled={disableOption}
        >
          <AttachFileIcon className={classes.sendMessageIcons} />
        </IconButton>
      </Tooltip>
    </>
  );
};
