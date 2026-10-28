import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/theme.css";
import "@/styles/controls.css";
import "@/styles/editor.css";
import { applyTheme, readStoredTheme } from "@/editor/hooks/useTheme";
import { CameraSetupPage } from "./CameraSetupPage";

applyTheme(readStoredTheme());

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <CameraSetupPage />
    </StrictMode>,
  );
}
