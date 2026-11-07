import { IconDownload, IconHome, IconLink, IconMoon, IconPencil, IconSun, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { saveVideoFile } from "@/export/saveVideo";
import { deleteProject, getProject, putProject } from "@/shared/db";
import { countExport } from "@/shared/rating";
import type { ProjectId, ProjectRecord } from "@/shared/types";
import { LicenseStatus } from "../components/LicenseStatus";
import { promptRatingIfDue } from "../components/RatingDialog";
import { ShareStatus } from "../components/ShareStatus";
import { IconButton, ProjectTitle } from "../components/TopBar";
import { useInstantShare } from "../hooks/useInstantShare";
import { useInstantTakeover } from "../hooks/useInstantTakeover";
import { useInstantVideo, type InstantVideoState } from "../hooks/useInstantVideo";
import { isSharing } from "../hooks/useShareLink";
import { useTheme } from "../hooks/useTheme";
import { fileNameFor, formatDuration, formatFileSize } from "../lib/format";
import { thumbnailUrl } from "../lib/thumbnailUrl";
import { CenteredMessage } from "./EditorPage";

const SECONDARY_BUTTON = "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs text-foreground transition-colors hover:bg-accent/70 disabled:opacity-40";

export function InstantPage({ projectId, onHome, onEdit }: { projectId: ProjectId; onHome: () => void; onEdit: () => void }) {
  const [project, setProject] = useState<ProjectRecord | null | undefined>(undefined);

  useEffect(() => {
    void getProject(projectId).then((loaded) => setProject(loaded ?? null));
  }, [projectId]);

  if (project === undefined) return <CenteredMessage>Loading recording…</CenteredMessage>;
  if (project === null) return <CenteredMessage>This recording no longer exists.</CenteredMessage>;
  return <InstantView initialProject={project} onHome={onHome} onEdit={onEdit} />;
}

function InstantView({ initialProject, onHome, onEdit }: { initialProject: ProjectRecord; onHome: () => void; onEdit: () => void }) {
  const [project, setProject] = useState(initialProject);
  const instant = useInstantVideo(project.id);
  const ready = instant.status === "ready" ? instant : null;
  const { theme, toggleTheme } = useTheme();

  const updateProject = (patch: Partial<ProjectRecord>) => {
    const next = { ...project, ...patch };
    setProject(next);
    void putProject(next);
  };

  const share = useInstantShare(project, ready?.video ?? null, ready?.poster ?? null, (next) => updateProject({ share: next }));

  const download = async () => {
    if (!ready) return;
    const result = await saveVideoFile(ready.video, fileNameFor(project.name, "mp4")).catch(() => null);
    if (result?.status !== "saved") return;
    await countExport();
    await promptRatingIfDue();
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    await deleteProject(project.id);
    onHome();
  };

  return (
    <div className="screenix-editor flex h-full flex-col overflow-hidden bg-background">
      <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b bg-background px-3">
        <div className="flex items-center gap-2">
          <IconButton title="All recordings" onClick={onHome}>
            <IconHome size={15} stroke={1.8} />
          </IconButton>
        </div>
        <ProjectTitle name={project.name} onRename={(name) => updateProject({ name })} />
        <div className="flex items-center justify-end gap-2">
          <LicenseStatus />
          <span className="mx-1 h-5 w-px bg-border" />
          <IconButton title={theme === "dark" ? "Light mode" : "Dark mode"} onClick={toggleTheme}>
            {theme === "dark" ? <IconSun size={15} stroke={1.8} /> : <IconMoon size={15} stroke={1.8} />}
          </IconButton>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--editor-workspace-background)] px-6 py-10">
        <div className="mx-auto w-full max-w-[960px]">
          {instant.status === "ready" ? (
            <div className="instant-reveal space-y-4">
              <video
                src={thumbnailUrl(instant.video)}
                poster={instant.poster ? thumbnailUrl(instant.poster) : undefined}
                controls
                playsInline
                className="block max-h-[68vh] w-full rounded-xl border bg-black"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isSharing(share.state)}
                  onClick={() => void share.share()}
                  className="gold-button flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs"
                >
                  <IconLink size={14} stroke={2} />
                  {project.share ? "Copy link" : "Get share link"}
                </button>
                <button type="button" onClick={() => void download()} className={SECONDARY_BUTTON}>
                  <IconDownload size={14} stroke={2} />
                  Download MP4
                </button>
                <button type="button" onClick={onEdit} className={SECONDARY_BUTTON}>
                  <IconPencil size={14} stroke={2} />
                  Edit in Studio
                </button>
                <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">
                  {formatDuration(project.duration)}, {formatFileSize(instant.video.size)}
                </span>
                <IconButton title="Delete recording" onClick={() => void remove()}>
                  <IconTrash size={15} stroke={1.8} />
                </IconButton>
              </div>
              <ShareStatus share={share.state} />
            </div>
          ) : (
            <Finishing instant={instant} project={project} onEdit={onEdit} />
          )}
        </div>
      </main>
    </div>
  );
}

function aspectRatioOf(project: ProjectRecord): string {
  return project.width > 0 && project.height > 0 ? `${project.width} / ${project.height}` : "16 / 9";
}

function Finishing({ instant, project, onEdit }: { instant: Exclude<InstantVideoState, { status: "ready" }>; project: ProjectRecord; onEdit: () => void }) {
  const takeover = useInstantTakeover(instant, project);
  const thumbnail = project.thumbnail ? thumbnailUrl(project.thumbnail) : null;
  if (takeover.status === "failed") return <Failure project={project} thumbnail={thumbnail} message={takeover.message} onEdit={onEdit} />;

  const progress = takeover.status === "rendering" ? takeover.progress : instant.status === "rendering" ? instant.progress : 0;
  const percent = Math.min(100, Math.round(progress * 100));
  return (
    <div className="space-y-5">
      <div
        role="progressbar"
        aria-label="Finishing your video"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="relative max-h-[68vh] w-full overflow-hidden rounded-xl border bg-black"
        style={{ aspectRatio: aspectRatioOf(project) }}
      >
        {thumbnail && (
          <>
            <img src={thumbnail} alt="" className="absolute inset-0 size-full scale-105 object-cover opacity-35 blur-lg grayscale" />
            <img
              src={thumbnail}
              alt=""
              className="absolute inset-0 size-full object-cover transition-[clip-path] duration-500 ease-out motion-reduce:transition-none"
              style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
            />
          </>
        )}
        {percent > 0 && percent < 100 && (
          <div
            className="absolute inset-y-0 w-px bg-ring shadow-[0_0_16px_2px_var(--color-ring)] transition-[left] duration-500 ease-out motion-reduce:transition-none"
            style={{ left: `${percent}%` }}
          />
        )}
      </div>
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <p className="text-[15px] font-semibold">Finishing your video</p>
          <p className="text-[13px] text-muted-foreground">It plays here as soon as it's ready.</p>
        </div>
        <span className="text-[15px] font-semibold tabular-nums">{percent}%</span>
      </div>
      <button type="button" onClick={onEdit} className="text-[12px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Edit in Studio instead
      </button>
    </div>
  );
}

function Failure({ project, thumbnail, message, onEdit }: { project: ProjectRecord; thumbnail: string | null; message: string; onEdit: () => void }) {
  return (
    <div className="relative grid max-h-[68vh] w-full place-items-center overflow-hidden rounded-xl border bg-black" style={{ aspectRatio: aspectRatioOf(project) }}>
      {thumbnail && <img src={thumbnail} alt="" className="absolute inset-0 size-full object-cover opacity-25 blur-md" />}
      <div className="relative max-w-[340px] space-y-3 px-6 text-center text-white">
        <p className="text-[15px] font-semibold">This video couldn't be finished</p>
        <p className="text-[13px] text-white/70">{message}</p>
        <button type="button" onClick={onEdit} className="gold-button h-8 rounded-lg px-3 text-xs">Open in Studio</button>
      </div>
    </div>
  );
}
