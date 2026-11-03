import React from "react";
import { useTheme } from "@material-ui/core/styles";
import { PRODUCT_NAME, resolveProductName } from "../../helpers/productBrand";

const defaultLogos = new Set(["/vector/logo.svg", "/vector/logo-dark.svg"]);

const BrandLogo = ({ compact = false, surface = "page", ...props }) => {
  const theme = useTheme();
  const name = resolveProductName(theme.appName);
  const configured = compact
    ? theme.calculatedLogoFavicon?.()
    : theme.calculatedLogo?.();
  const darkSurface = surface === "sidebar" || theme.palette.type === "dark";
  const fallback = compact
    ? "/vector/favicon.svg"
    : darkSurface
      ? "/vector/logo-dark.svg"
      : "/vector/logo.svg";
  const src =
    !configured || (surface === "sidebar" && defaultLogos.has(configured))
      ? fallback
      : configured;
  const isProductLogo = !compact && defaultLogos.has(src);

  return (
    <img
      {...props}
      src={src}
      alt={
        isProductLogo && name === PRODUCT_NAME
          ? `${PRODUCT_NAME} — Powered by Komunick Inteligência`
          : name
      }
    />
  );
};

export default BrandLogo;
