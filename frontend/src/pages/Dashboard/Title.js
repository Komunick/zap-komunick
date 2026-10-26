import React from "react";
import Typography from "@material-ui/core/Typography";

const Title = props => {
  return (
    <Typography
      component="h2"
      gutterBottom
      style={{ fontSize: 16, fontWeight: 700 }}
    >
      {props.children}
    </Typography>
  );
};

export default Title;
