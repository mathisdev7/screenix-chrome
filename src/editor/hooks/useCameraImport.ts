import { useState } from "react";
import { putProject } from "@/shared/db";
import type { EditorSettings } from "@/shared/settings";
import type { ProjectRecord } from "@/shared/types";
import { importCameraVideo } from "../lib/importCameraVideo";

export type CameraImportState =
  | { status: "idle" }
  | { status: "importing"; progress: number }
  | { status: "failed"; message: string };

export function useCameraImport(project: ProjectRecord, settings: EditorSettings) {
  const [state, setState] = useState<CameraImportState>({ status: "idle" });

  const importVideo = async (file: File) => {
    setState({ status: "importing", progress: 0 });
    try {
      const camera = await importCameraVideo(project, file, (progress) => setState({ status: "importing", progress }));
      await putProject({ ...project, settings: { ...settings, camera: { ...settings.camera, enabled: true } }, camera });
      window.location.reload();
    } catch (error) {
      setState({ status: "failed", message: error instanceof Error ? error.message : String(error) });
    }
  };

  return { state, importVideo };
}
