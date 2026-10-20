import { IconArrowBackUp, IconArrowForwardUp, IconDownload, IconHome, IconLink, IconMoon, IconSun, IconWorld } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import type { Theme } from "../hooks/useTheme";

export function IconButton({ title, onClick, disabled, children }: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function ProjectTitle({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft !== null) {
    const commit = () => {
      const trimmed = draft.trim();
      if (trimmed && trimmed !== name) onRename(trimmed);
      setDraft(null);
    };
    return (
      <input
        autoFocus
        aria-label="Project name"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setDraft(null);
        }}
        className="w-[320px] rounded-lg border bg-surface-1 px-3 py-1.5 text-center text-[13px] outline-none focus:border-ring"
      />
    );
  }

  return (
    <button
      type="button"
      title="Rename"
      onClick={() => setDraft(name)}
      className="flex max-w-[360px] items-center gap-1.5 truncate rounded-lg px-3 py-1.5 text-[13px] hover:bg-accent/70"
    >
      <span className="truncate font-medium text-foreground">{name}</span>
    </button>
  );
}

export function TopBar({ projectName, onRename, onHome, onUndo, onRedo, canUndo, canRedo, theme, onToggleTheme, licensed, onRemoveWatermark, onEnterLicenseKey, shared, onShare, onExport }: {
  projectName: string;
  onRename: (name: string) => void;
  onHome: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  licensed: boolean;
  onRemoveWatermark: () => void;
  onEnterLicenseKey: () => void;
  shared: boolean;
  onShare: () => void;
  onExport: () => void;
}) {
  return (
    <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b bg-background px-3">
      <div className="flex items-center gap-2">
        <IconButton title="All recordings" onClick={onHome}>
          <IconHome size={15} stroke={1.8} />
        </IconButton>
        <span className="h-5 w-px bg-border" />
        <IconButton title="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}>
          <IconArrowBackUp size={15} stroke={1.8} />
        </IconButton>
        <IconButton title="Redo (Ctrl+Shift+Z)" onClick={onRedo} disabled={!canRedo}>
          <IconArrowForwardUp size={15} stroke={1.8} />
        </IconButton>
      </div>
      <ProjectTitle name={projectName} onRename={onRename} />
      <div className="flex items-center justify-end gap-1.5">
        <IconButton title={theme === "dark" ? "Light mode" : "Dark mode"} onClick={onToggleTheme}>
          {theme === "dark" ? <IconSun size={15} stroke={1.8} /> : <IconMoon size={15} stroke={1.8} />}
        </IconButton>
        <span className="mx-1 h-5 w-px bg-border" />
        {!licensed && (
          <>
            <button type="button" onClick={onEnterLicenseKey} className="h-7 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              Have a license key?
            </button>
            <button
              type="button"
              onClick={onRemoveWatermark}
              className="flex h-7 items-center rounded-lg border px-3 text-xs text-foreground transition-colors hover:bg-accent/70"
            >
              Remove watermark
            </button>
          </>
        )}
        <button
          type="button"
          title={shared ? "Manage the shared video" : "Get a share link"}
          onClick={onShare}
          className="flex h-7 items-center gap-1.5 rounded-lg border px-3 text-xs text-foreground transition-colors hover:bg-accent/70"
        >
          {shared ? <IconWorld size={14} stroke={2} className="text-[#70b38f]" /> : <IconLink size={14} stroke={2} />}
          {shared ? "Shared" : "Share"}
        </button>
        <button type="button" onClick={onExport} className="gold-button flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs">
          <IconDownload size={14} stroke={2} />
          Export
        </button>
      </div>
    </header>
  );
}
