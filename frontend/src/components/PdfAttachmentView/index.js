import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  CircularProgress,
  IconButton,
  makeStyles,
  TextField,
  Tooltip,
  Typography
} from "@material-ui/core";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "@material-ui/icons";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.entry";
import { i18n } from "../../translate/i18n";

GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PIXELS = 8000000;
// Source scans may exceed the display canvas budget before being downscaled.
const MAX_SOURCE_IMAGE_PIXELS = 32000000;
const MAX_EDGE = 8192;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

const useStyles = makeStyles(theme => ({
  root: { width: "100%", minWidth: 0 },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    color: theme.komunick?.text || theme.palette.text.primary
  },
  pageInput: { width: 78 },
  zoom: { minWidth: 48, textAlign: "center" },
  viewport: {
    width: "100%",
    minWidth: 0,
    minHeight: 260,
    maxHeight: "65vh",
    overflow: "auto",
    boxSizing: "border-box",
    padding: theme.spacing(2),
    background: theme.komunick?.canvas || theme.palette.background.default,
    border: `1px solid ${theme.komunick?.border || theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius
  },
  canvas: { display: "block", margin: "0 auto" },
  status: {
    minHeight: 220,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    color: theme.komunick?.textSecondary || theme.palette.text.secondary
  }
}));

// PDF.js may reject a destroy promise after an in-flight task is cancelled.
// Disposal deliberately keeps PDF data and parser errors out of telemetry.
function destroy(target) {
  try {
    const pending = target?.destroy?.();
    pending?.catch?.(() => {});
  } catch {
    // The task may already have been destroyed by PDF.js.
  }
}

function PdfAttachmentView({ blob, fileName }) {
  const classes = useStyles();
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const [documentState, setDocumentState] = useState(null);
  const [loadState, setLoadState] = useState(null);
  const [renderState, setRenderState] = useState(null);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [width, setWidth] = useState(600);
  const [fit, setFit] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [effectiveZoom, setEffectiveZoom] = useState(1);
  const pdf = documentState?.blob === blob ? documentState.pdf : null;
  const count = pdf?.numPages || 0;

  useEffect(() => {
    const viewport = viewportRef.current;
    const measure = () => {
      const measured = viewport?.getBoundingClientRect().width;
      if (Number.isFinite(measured) && measured > 0) {
        setWidth(Math.max(1, Math.floor(measured) - 32));
      }
    };
    measure();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (observer && viewport) observer.observe(viewport);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task;
    let loaded;
    let passwordRequired = false;
    const disposed = new Set();
    const dispose = target => {
      if (!target || disposed.has(target)) return;
      disposed.add(target);
      destroy(target);
    };
    setDocumentState(null);
    setLoadState({ blob, status: "loading" });
    setPage(1);
    setPageInput("1");
    setFit(true);
    setZoom(1);
    setEffectiveZoom(1);

    (async () => {
      try {
        if (
          !blob ||
          typeof blob.arrayBuffer !== "function" ||
          !Number.isFinite(blob.size) ||
          blob.size <= 0 ||
          blob.size > MAX_BYTES
        ) {
          throw new Error();
        }
        const bytes = await blob.arrayBuffer();
        if (cancelled) return;
        task = getDocument({
          data: new Uint8Array(bytes),
          // Mozilla GHSA-wgrm-67xf-hhpq workaround for the existing PDF.js.
          isEvalSupported: false,
          enableXfa: false,
          useWorkerFetch: false,
          isOffscreenCanvasSupported: false,
          verbosity: 0,
          maxImageSize: MAX_SOURCE_IMAGE_PIXELS,
          stopAtErrors: true
        });
        task.onPassword = () => {
          if (cancelled) return;
          passwordRequired = true;
          setLoadState({ blob, status: "password" });
          dispose(task);
        };
        loaded = await task.promise;
        if (cancelled || passwordRequired) {
          dispose(loaded);
          return;
        }
        if (!Number.isSafeInteger(loaded.numPages) || loaded.numPages < 1) {
          throw new Error();
        }
        setDocumentState({ blob, pdf: loaded });
        setLoadState({ blob, status: "ready" });
      } catch (error) {
        if (!cancelled) {
          setLoadState({
            blob,
            status:
              passwordRequired || error?.name === "PasswordException"
                ? "password"
                : "failed"
          });
          dispose(loaded || task);
        }
      }
    })();

    return () => {
      cancelled = true;
      dispose(loaded || task);
    };
  }, [blob]);

  useEffect(() => {
    const canvas = canvasRef.current;
    let cancelled = false;
    let pdfPage;
    let rendering;
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    if (!pdf) return undefined;
    setRenderState({ pdf, page, status: "loading" });

    (async () => {
      try {
        pdfPage = await pdf.getPage(page);
        if (cancelled) {
          pdfPage.cleanup?.();
          return;
        }
        const base = pdfPage.getViewport({ scale: 1 });
        if (
          !Number.isFinite(base.width) ||
          !Number.isFinite(base.height) ||
          base.width <= 0 ||
          base.height <= 0
        ) {
          throw new Error();
        }
        const requested = fit ? width / base.width : zoom;
        const scale = Math.min(
          MAX_ZOOM,
          requested,
          MAX_EDGE / base.width,
          MAX_EDGE / base.height,
          Math.sqrt(MAX_PIXELS / base.width / base.height)
        );
        const viewport = pdfPage.getViewport({ scale });
        const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
        const outputScale = Math.min(
          dpr,
          Math.sqrt(MAX_PIXELS / viewport.width / viewport.height),
          MAX_EDGE / viewport.width,
          MAX_EDGE / viewport.height
        );
        canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
        canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const context = canvas.getContext("2d");
        if (!context) throw new Error();
        setEffectiveZoom(scale);
        rendering = pdfPage.render({
          canvasContext: context,
          viewport,
          transform: [outputScale, 0, 0, outputScale, 0, 0],
          annotationMode: 0
        });
        await rendering.promise;
        if (!cancelled) setRenderState({ pdf, page, status: "ready" });
      } catch {
        if (!cancelled) {
          canvas.width = 0;
          canvas.height = 0;
          setRenderState({ pdf, page, status: "failed" });
        }
      }
    })();

    return () => {
      cancelled = true;
      rendering?.cancel();
      // cleanup() defers releasing a page that still has a rendering task.
      pdfPage?.cleanup?.();
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [pdf, page, fit, width, zoom]);

  const goToPage = next => {
    if (!Number.isSafeInteger(next) || next < 1 || next > count) return;
    setPage(next);
    setPageInput(String(next));
    viewportRef.current?.scrollTo?.(0, 0);
  };
  const commitPage = () => {
    const next = /^\d+$/.test(pageInput.trim()) ? Number(pageInput) : NaN;
    if (Number.isSafeInteger(next) && next >= 1 && next <= count) {
      goToPage(next);
    } else {
      setPageInput(String(page));
    }
  };
  const changeZoom = delta => {
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, effectiveZoom + delta)));
    setFit(false);
  };
  const currentRender = renderState?.pdf === pdf && renderState?.page === page;
  const loadedStatus = loadState?.blob === blob ? loadState.status : "loading";
  const ready = !!pdf && currentRender && renderState.status === "ready";
  const failure =
    loadedStatus === "password"
      ? "password"
      : loadedStatus === "failed" ||
          (currentRender && renderState.status === "failed")
        ? "failed"
        : null;
  const pageCount = i18n.t("attachments.pdf.pageCount", { page, count });

  return (
    <section className={classes.root} aria-label={fileName || pageCount}>
      <div className={classes.toolbar} role="toolbar" aria-label={pageCount}>
        <Tooltip title={i18n.t("attachments.pdf.previous")}>
          <span>
            <IconButton
              aria-label={i18n.t("attachments.pdf.previous")}
              disabled={!pdf || page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft />
            </IconButton>
          </span>
        </Tooltip>
        <TextField
          className={classes.pageInput}
          label={i18n.t("attachments.pdf.page")}
          value={pageInput}
          disabled={!pdf}
          onChange={event => setPageInput(event.target.value)}
          onBlur={commitPage}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitPage();
            }
          }}
          inputProps={{
            inputMode: "numeric",
            pattern: "[0-9]*",
            "aria-label": i18n.t("attachments.pdf.page")
          }}
          variant="outlined"
          size="small"
        />
        <Typography variant="caption" aria-live="polite">
          {pageCount}
        </Typography>
        <Tooltip title={i18n.t("attachments.pdf.next")}>
          <span>
            <IconButton
              aria-label={i18n.t("attachments.pdf.next")}
              disabled={!pdf || page >= count}
              onClick={() => goToPage(page + 1)}
            >
              <ChevronRight />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={i18n.t("attachments.pdf.zoomOut")}>
          <span>
            <IconButton
              aria-label={i18n.t("attachments.pdf.zoomOut")}
              disabled={!pdf || effectiveZoom <= MIN_ZOOM}
              onClick={() => changeZoom(-0.25)}
            >
              <ZoomOut />
            </IconButton>
          </span>
        </Tooltip>
        <Typography className={classes.zoom} variant="caption">
          {Math.round(effectiveZoom * 100)}%
        </Typography>
        <Tooltip title={i18n.t("attachments.pdf.zoomIn")}>
          <span>
            <IconButton
              aria-label={i18n.t("attachments.pdf.zoomIn")}
              disabled={!pdf || effectiveZoom >= MAX_ZOOM}
              onClick={() => changeZoom(0.25)}
            >
              <ZoomIn />
            </IconButton>
          </span>
        </Tooltip>
        <Button disabled={!pdf} onClick={() => setFit(true)}>
          {i18n.t("attachments.pdf.fit")}
        </Button>
      </div>
      <div
        className={classes.viewport}
        ref={viewportRef}
        aria-busy={!ready && !failure}
      >
        {!ready && (
          <div className={classes.status} role={failure ? "alert" : "status"}>
            {!failure && <CircularProgress size={24} />}
            <Typography>
              {i18n.t(`attachments.pdf.${failure || "loading"}`)}
            </Typography>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={classes.canvas}
          role="img"
          aria-label={`${fileName || ""} ${pageCount}`.trim()}
          style={{ display: ready ? "block" : "none" }}
        />
      </div>
    </section>
  );
}

export default PdfAttachmentView;
