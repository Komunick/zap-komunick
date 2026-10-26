import React from "react";
import Typography from "@material-ui/core/Typography";

export default function Title(props) {
  return (
    // Zap Komunick (Direção B): page titles in the text color, bold
    <Typography
      variant="h5"
      color="textPrimary"
      gutterBottom
      style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.01em" }}
    >
      {props.children}
    </Typography>
  );
}
