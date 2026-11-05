import React, { lazy, Suspense } from "react";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import Typography from "@material-ui/core/Typography";

import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";

const RouteLoadError = () => (
  <Box display="flex" flexDirection="column" alignItems="center" py={4}>
    <Typography role="alert">{i18n.t("common.error")}</Typography>
    <Button color="primary" onClick={() => window.location.reload()}>
      {i18n.t("connections.buttons.tryAgain")}
    </Button>
  </Box>
);

export const lazyRoute = load =>
  lazy(() =>
    load().catch(error => {
      // An open tab may still reference an asset from the previous deployment.
      if (
        error?.name === "ChunkLoadError" ||
        error?.code === "CSS_CHUNK_LOAD_FAILED"
      ) {
        return { default: RouteLoadError };
      }
      throw error;
    })
  );

const LazyRouteContent = ({ children, fullPage = false }) => (
  <Suspense
    fallback={
      fullPage ? (
        <BackdropLoading />
      ) : (
        <Box display="flex" justifyContent="center" py={4} role="status">
          <CircularProgress size={24} />
        </Box>
      )
    }
  >
    {children}
  </Suspense>
);

export default LazyRouteContent;
