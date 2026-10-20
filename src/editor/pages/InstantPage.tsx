import { IconDownload, IconHome, IconLink, IconLoader2, IconMoon, IconPencil, IconSun, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { saveVideoFile } from "@/export/saveVideo";
import { deleteProject, getProject, putProject } from "@/shared/db";
import type { ProjectId, ProjectRecord } from "@/shared/types";
import { LicenseStatus } from "../components/LicenseStatus";
import { ShareStatus } from "../components/ShareStatus";
import { IconButton, ProjectTitle } from "../components/TopBar";
import { useInstantShare } from "../hooks/useInstantShare";
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
    if (ready) await saveVideoFile(ready.video, fileNameFor(project.name, "mp4")).catch(() => undefined);
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
      <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--editor-workspace-background)] px-6 py-8">
        <div className="mx-auto w-full max-w-[960px] space-y-4">
          <Stage instant={instant} project={project} onEdit={onEdit} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!ready || isSharing(share.state)}
              onClick={() => void share.share()}
              className="gold-button flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs"
            >
              <IconLink size={14} stroke={2} />
              {project.share ? "Copy link" : "Get share link"}
            </button>
            <button type="button" disabled={!ready} onClick={() => void download()} className={SECONDARY_BUTTON}>
              <IconDownload size={14} stroke={2} />
              Download MP4
            </button>
            <button type="button" onClick={onEdit} className={SECONDARY_BUTTON}>
              <IconPencil size={14} stroke={2} />
              Edit in Studio
            </button>
            <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">
              {formatDuration(project.duration)}
              {ready && ` · ${formatFileSize(ready.video.size)}`}
            </span>
            <IconButton title="Delete recording" onClick={() => void remove()}>
              <IconTrash size={15} stroke={1.8} />
            </IconButton>
          </div>
          <ShareStatus share={share.state} />
        </div>
      </main>
    </div>
  );
}

function Stage({ instant, project, onEdit }: { instant: InstantVideoState; project: ProjectRecord; onEdit: () => void }) {
  if (instant.status === "ready") {
    return (
      <video
        src={thumbnailUrl(instant.video)}
        poster={instant.poster ? thumbnailUrl(instant.poster) : undefined}
        controls
        playsInline
        className="block max-h-[68vh] w-full rounded-xl border bg-black"
      />
    );
  }

  const aspectRatio = project.width > 0 && project.height > 0 ? `${project.width} / ${project.height}` : "16 / 9";
  return (
    <div className="relative grid max-h-[68vh] w-full place-items-center overflow-hidden rounded-xl border bg-black" style={{ aspectRatio }}>
      {project.thumbnail && <img src={thumbnailUrl(project.thumbnail)} alt="" className="absolute inset-0 size-full object-cover opacity-30 blur-sm" />}
      <div className="relative w-[300px] space-y-3 text-center text-white">
        {instant.status === "failed" ? (
          <>
            <p className="text-[14px] font-semibold">The instant video couldn't be finished</p>
            <p className="text-[12px] text-white/70">{instant.message}</p>
            <button type="button" onClick={onEdit} className="gold-button h-8 rounded-lg px-3 text-xs">Open in Studio</button>
          </>
        ) : (
          <>
            <IconLoader2 size={22} className="mx-auto animate-spin" />
            <p className="text-[14px] font-semibold">Finishing your video…</p>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-[width]"
                style={{ width: `${(instant.status === "rendering" ? instant.progress : 0) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
