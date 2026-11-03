import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createMuiTheme, ThemeProvider } from "@material-ui/core/styles";
import BrandLogo from ".";

const showLogo = ({
  mode = "light",
  name = "SuperChat",
  logo,
  icon,
  ...props
} = {}) =>
  render(
    <ThemeProvider
      theme={createMuiTheme({
        palette: { type: mode },
        appName: name,
        calculatedLogo: () => logo,
        calculatedLogoFavicon: () => icon
      })}
    >
      <BrandLogo {...props} />
    </ThemeProvider>
  );

test.each(["light", "dark"])(
  "identifies the full brand and official endorsement in %s",
  mode => {
    showLogo({ mode });
    expect(
      screen.getByRole("img", {
        name: "SuperChat — Powered by Komunick Inteligência"
      })
    ).toHaveAttribute(
      "src",
      mode === "dark" ? "/vector/logo-dark.svg" : "/vector/logo.svg"
    );
  }
);

test.each(["light", "dark"])(
  "keeps the default logo legible on the black sidebar in %s",
  mode => {
    showLogo({ mode, surface: "sidebar", logo: "/vector/logo.svg" });
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/vector/logo-dark.svg"
    );
  }
);

it("uses a compact symbol when the menu is collapsed", () => {
  showLogo({ compact: true });
  expect(screen.getByRole("img", { name: "SuperChat" })).toHaveAttribute(
    "src",
    "/vector/favicon.svg"
  );
});

it("preserves a company's configured image and name on the sidebar", () => {
  showLogo({
    name: "Escritório Fictício",
    logo: "/public/custom-company.svg",
    surface: "sidebar"
  });
  expect(
    screen.getByRole("img", { name: "Escritório Fictício" })
  ).toHaveAttribute("src", "/public/custom-company.svg");
});

it("preserves the configured compact icon", () => {
  showLogo({ compact: true, icon: "/public/custom-icon.png" });
  expect(screen.getByRole("img")).toHaveAttribute(
    "src",
    "/public/custom-icon.png"
  );
});
