import { useEffect, useState } from "react";
import { loadProjectMedia, type ProjectMedia } from "@/render/projectMedia";
import type { ProjectId } from "@/shared/types";

export type ProjectMediaState =
  | { status: "loading" }
  | { status: "ready"; media: ProjectMedia }
  | { status: "error"; message: string };

function disposeMedia(media: ProjectMedia) {
  media.frames.dispose();
  media.camera?.dispose();
}

export function useProjectMedia(projectId: ProjectId): ProjectMediaState {
  const [state, setState] = useState<ProjectMediaState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    let loaded: ProjectMedia | null = null;
    loadProjectMedia(projectId).then(
      (media) => {
        loaded = media;
        if (active) setState({ status: "ready", media });
        else disposeMedia(media);
      },
      (error: unknown) => {
        if (active) setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      active = false;
      if (loaded) disposeMedia(loaded);
    };
  }, [projectId]);

  return state;
}
