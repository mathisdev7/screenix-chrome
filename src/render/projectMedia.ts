import { getCameraFrames, getFrames, getPointerSamples, getProject } from "@/shared/db";
import type { PointerSample, ProjectId, ProjectRecord } from "@/shared/types";
import { loadAudioTracks, type LoadedAudioTrack } from "./audioTracks";
import { FrameSequence } from "./frameSequence";
import type { Size } from "./geometry";

const FALLBACK_SOURCE: Size = { width: 1920, height: 1080 };

export interface ProjectMedia {
  project: ProjectRecord;
  frames: FrameSequence;
  camera: FrameSequence | null;
  audio: LoadedAudioTrack[];
  pointer: PointerSample[];
  source: Size;
}

export async function loadProjectMedia(id: ProjectId): Promise<ProjectMedia> {
  const project = await getProject(id);
  if (!project) throw new Error("This recording no longer exists.");
  const [frames, pointer, cameraFrames, audio] = await Promise.all([
    getFrames(id),
    getPointerSamples(id),
    project.camera ? getCameraFrames(id) : [],
    loadAudioTracks(id, project.audioTracks ?? []),
  ]);
  const sequence = new FrameSequence(frames);
  let source: Size = project.width > 0 ? { width: project.width, height: project.height } : FALLBACK_SOURCE;
  if (project.width === 0 && sequence.length > 0) {
    const first = await sequence.decode(0);
    source = { width: first.width, height: first.height };
  }
  const camera = cameraFrames.length > 0 ? new FrameSequence(cameraFrames) : null;
  return { project, frames: sequence, camera, audio, pointer, source };
}
