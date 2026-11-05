import React from "react";
import { useTheme } from "@material-ui/core/styles";
import {
  PRODUCT_ICON,
  resolveProductName,
  usesDefaultProductLogo
} from "../../helpers/productBrand";

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
    !configured || (!compact && usesDefaultProductLogo(configured))
      ? fallback
      : configured;

  return <img {...props} src={src} alt={name} />;
};

export default BrandLogo;
