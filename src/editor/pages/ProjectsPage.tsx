import { IconMoon, IconSun, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { deleteProject, listProjects } from "@/shared/db";
import type { ProjectId, ProjectRecord } from "@/shared/types";
import { LicenseStatus } from "../components/LicenseStatus";
import { IconButton } from "../components/TopBar";
import { useTheme } from "../hooks/useTheme";
import { formatDuration } from "../lib/format";

const thumbnailUrls = new WeakMap<Blob, string>();

function thumbnailUrl(blob: Blob): string {
  let url = thumbnailUrls.get(blob);
  if (!url) {
    url = URL.createObjectURL(blob);
    thumbnailUrls.set(blob, url);
  }
  return url;
}

function Thumbnail({ blob }: { blob: Blob | null }) {
  const url = blob ? thumbnailUrl(blob) : null;
  return url
    ? <img src={url} alt="" className="aspect-video w-full object-cover" />
    : <div className="aspect-video w-full bg-surface-2" />;
}

function ProjectCard({ project, onOpen, onDelete }: {
  project: ProjectRecord;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-surface-1 transition-colors hover:border-ring/60">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <Thumbnail blob={project.thumbnail} />
        <div className="space-y-0.5 px-3 py-2.5">
          <p className="truncate text-[13px] font-medium">{project.name}</p>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {new Date(project.createdAt).toLocaleString()} · {formatDuration(project.duration)}
          </p>
        </div>
      </button>
      <button
        type="button"
        title="Delete recording"
        aria-label="Delete recording"
        onClick={onDelete}
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg bg-black/60 text-white opacity-0 transition-opacity hover:bg-[#a13c41] group-hover:opacity-100"
      >
        <IconTrash size={14} stroke={1.8} />
      </button>
    </div>
  );
}

export function ProjectsPage({ onOpen }: { onOpen: (id: ProjectId) => void }) {
  const [projects, setProjects] = useState<ProjectRecord[] | null>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    void listProjects().then(setProjects);
  }, []);

  const remove = async (project: ProjectRecord) => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    await deleteProject(project.id);
    setProjects((current) => current?.filter((item) => item.id !== project.id) ?? null);
  };

  return (
    <div className="screenix-editor flex h-full flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <img src="/icons/icon-32.png" alt="" className="size-5" />
          <span className="text-[13px] font-semibold">Screenix recordings</span>
        </div>
        <div className="flex items-center gap-2">
          <LicenseStatus />
          <span className="mx-1 h-5 w-px bg-border" />
          <IconButton title={theme === "dark" ? "Light mode" : "Dark mode"} onClick={toggleTheme}>
            {theme === "dark" ? <IconSun size={15} stroke={1.8} /> : <IconMoon size={15} stroke={1.8} />}
          </IconButton>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-6">
        {projects?.length === 0 && (
          <div className="mx-auto mt-24 max-w-sm space-y-2 text-center">
            <p className="text-[15px] font-semibold">No recordings yet</p>
            <p className="text-[13px] text-muted-foreground">
              Click the Screenix icon in the Chrome toolbar, or press Alt+Shift+R, to record the current tab.
            </p>
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {projects?.map((project) => (
            <ProjectCard key={project.id} project={project} onOpen={() => onOpen(project.id)} onDelete={() => void remove(project)} />
          ))}
        </div>
      </main>
    </div>
  );
}
