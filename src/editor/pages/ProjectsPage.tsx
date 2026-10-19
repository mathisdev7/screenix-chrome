import { IconMoon, IconVideo, IconSearch, IconSun, IconTrash, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { deleteProject, listProjects } from "@/shared/db";
import type { ProjectId, ProjectRecord } from "@/shared/types";
import { LicenseStatus } from "../components/LicenseStatus";
import { IconButton } from "../components/TopBar";
import { useTheme } from "../hooks/useTheme";
import { formatDuration } from "../lib/format";
import { thumbnailUrl } from "../lib/thumbnailUrl";

function Thumbnail({ blob }: { blob: Blob | null }) {
  const url = blob ? thumbnailUrl(blob) : null;
  return url
    ? <img src={url} alt="" className="aspect-video w-full object-cover" />
    : <div className="aspect-video w-full bg-surface-2" />;
}

function hasCamera(project: ProjectRecord) {
  return !!project.camera?.frameCount && project.settings?.camera.enabled !== false;
}

function CameraBadge() {
  return (
    <span
      title="Camera recorded"
      className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white"
    >
      <IconVideo size={12} stroke={1.8} />
      Camera
    </span>
  );
}

function ProjectCard({ project, onOpen, onDelete }: {
  project: ProjectRecord;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-surface-1 transition-colors hover:border-ring/60">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative">
          <Thumbnail blob={project.thumbnail} />
          {hasCamera(project) && <CameraBadge />}
        </div>
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

function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative w-full max-w-[360px]">
      <IconSearch size={14} stroke={1.8} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        aria-label="Search recordings"
        placeholder="Search recordings"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onChange("");
        }}
        className="h-8 w-full rounded-lg border bg-surface-1 pl-8 pr-8 text-[13px] outline-none placeholder:text-muted-foreground focus:border-ring [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          title="Clear search"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-accent/70 hover:text-foreground"
        >
          <IconX size={12} stroke={2} />
        </button>
      )}
    </div>
  );
}

function matchesQuery(project: ProjectRecord, query: string) {
  const name = project.name.toLocaleLowerCase();
  return query.toLocaleLowerCase().split(/\s+/).filter(Boolean).every((word) => name.includes(word));
}

export function ProjectsPage({ onOpen }: { onOpen: (id: ProjectId) => void }) {
  const [projects, setProjects] = useState<ProjectRecord[] | null>(null);
  const [query, setQuery] = useState("");
  const { theme, toggleTheme } = useTheme();
  const visible = useMemo(() => projects?.filter((project) => matchesQuery(project, query)), [projects, query]);

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
      <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b px-4">
        <div className="flex items-center gap-2">
          <img src="/icons/icon-32.png" alt="" className="size-5" />
          <span className="text-[13px] font-semibold">Screenix recordings</span>
        </div>
        <div className="flex w-[360px] justify-center">
          {!!projects?.length && <SearchBar value={query} onChange={setQuery} />}
        </div>
        <div className="flex items-center justify-end gap-2">
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
        {!!projects?.length && visible?.length === 0 && (
          <div className="mx-auto mt-24 max-w-sm space-y-2 text-center">
            <p className="text-[15px] font-semibold">No matching recordings</p>
            <p className="text-[13px] text-muted-foreground">Nothing is named like "{query.trim()}".</p>
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {visible?.map((project) => (
            <ProjectCard key={project.id} project={project} onOpen={() => onOpen(project.id)} onDelete={() => void remove(project)} />
          ))}
        </div>
      </main>
    </div>
  );
}
