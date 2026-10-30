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

  const lightboxMedia = useMemo(() => {
    return buildMediaGalleryData(messages, {
      getMediaUrl: message => message?.mediaPath
    });
  }, [messages]);

  const openLightboxForMessage = messageId => {
    const index = lightboxMedia.byMessageId[messageId];
    if (index === undefined) {
      return;
    }

    setLightboxIndex(index);
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
    return () => {
      mountedRef.current = false;
      scrollToBottomRef.current = null;
      if (recordingRef.current) {
        recorder.stop();
        recordingRef.current = false;
      }
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

  const checkMessageMedia = message => {
    const mediaUrl = message.mediaPath;

    if (message.mediaType === "image") {
      return (
        <img
          className={classes.messageMedia}
          src={mediaUrl}
          alt={i18n.t("chatPage.messageImage")}
          style={{ cursor: "pointer" }}
          onClick={() => openLightboxForMessage(message.id)}
        />
      );
    }
    if (message.mediaType === "audio") {
      return (
        <audio controls style={{ maxWidth: "100%" }}>
          <source src={mediaUrl} type="audio/ogg"></source>
        </audio>
      );
    }

    if (message.mediaType === "video") {
      return (
        <div className={classes.videoPreviewWrapper}>
          <video
            ref={element => {
              if (element) {
                previewVideoRefs.current[message.id] = element;
              } else {
                delete previewVideoRefs.current[message.id];
              }
            }}
            className={classes.videoPreviewMedia}
            src={mediaUrl}
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
              target="_blank"
              href={mediaUrl}
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
