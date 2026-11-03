import React from "react";
import { useTheme } from "@material-ui/core/styles";
import {
  PRODUCT_ICON,
  PRODUCT_NAME,
  resolveProductName
} from "../../helpers/productBrand";

const defaultLogos = new Set([
  "/vector/logo.svg",
  "/vector/logo-dark.svg",
  "/vector/logo-header.svg",
  "/vector/logo-header-dark.svg"
]);

const BrandLogo = ({
  compact = false,
  surface = "page",
  variant = "full",
  ...props
}) => {
  const theme = useTheme();
  const name = resolveProductName(theme.appName);
  const configured = compact
    ? theme.calculatedLogoFavicon?.()
    : theme.calculatedLogo?.();
  const darkSurface = surface === "sidebar" || theme.palette.type === "dark";
  const fallback = compact
    ? PRODUCT_ICON
    : `/vector/logo${variant === "header" ? "-header" : ""}${darkSurface ? "-dark" : ""}.svg`;
  const src =
    !configured || (!compact && defaultLogos.has(configured))
      ? fallback
      : configured;
  const isProductLogo = !compact && defaultLogos.has(src);

  return (
    <img
      {...props}
      src={src}
      alt={
        isProductLogo && name === PRODUCT_NAME
          ? `${PRODUCT_NAME} — Powered by Komunick Inteligência e Tecnologia`
          : name
      }
    />
  );
};

export default BrandLogo;
