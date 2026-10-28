import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/theme.css";
import "@/styles/controls.css";
import "@/styles/editor.css";
import "@/styles/popup.css";
import { applyTheme, readStoredTheme } from "@/editor/hooks/useTheme";
import { Popup } from "./Popup";

applyTheme(readStoredTheme());

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Popup />
    </StrictMode>,
  );
}
