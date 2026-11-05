import React from "react";
import clsx from "clsx";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { showsKomunickEndorsement } from "../../helpers/productBrand";

const useStyles = makeStyles(theme => ({
  root: {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    color: theme.palette.text.secondary,
    fontSize: 12,
    whiteSpace: "nowrap"
  },
  logo: {
    display: "block",
    width: 84,
    height: "auto"
  }
}));

const KomunickEndorsement = ({ component: Component = "span", className }) => {
  const theme = useTheme();
  const classes = useStyles();
  const logoSuffix = theme.palette.type === "dark" ? "-dark" : "";

  if (!showsKomunickEndorsement(theme)) return null;

  return (
    <Component className={clsx(classes.root, className)}>
      <span lang="en">Powered by</span>
      <img
        className={classes.logo}
        src={`/vector/komunick-rodape${logoSuffix}.svg`}
        width="173"
        height="48"
        alt="Komunick Inteligência e Tecnologia"
      />
    </Component>
  );
};

export default KomunickEndorsement;
