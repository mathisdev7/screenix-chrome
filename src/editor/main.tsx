import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/theme.css";
import "@/styles/controls.css";
import "@/styles/editor.css";
import { applyTheme, readStoredTheme } from "./hooks/useTheme";
import { App } from "./App";
import { trackPointerOnExtensionPage } from "@/shared/trackExtensionPage";

applyTheme(readStoredTheme());
trackPointerOnExtensionPage();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
