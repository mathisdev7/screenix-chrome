import { useCallback, useState } from "react";
import { trimmedRange } from "@/export/exportVideo";
import type { ProjectMedia } from "@/render/projectMedia";
import { CUSTOM_WALLPAPER, CUSTOM_WALLPAPER_ASSET_KEY } from "@/render/wallpapers";
import { putAsset } from "@/shared/db";
import type { ProjectId } from "@/shared/types";
import { ExportDialog } from "../components/ExportDialog";
import { PreviewPane } from "../components/preview/PreviewPane";
import { AudioPanel } from "../components/sidebar/AudioPanel";
import { BackgroundPanel } from "../components/sidebar/BackgroundPanel";
import { CameraPanel } from "../components/sidebar/CameraPanel";
import { CursorPanel } from "../components/sidebar/CursorPanel";
import { RatioPanel } from "../components/sidebar/RatioPanel";
import { Sidebar, type SidebarTab } from "../components/sidebar/Sidebar";
import { Timeline } from "../components/timeline/Timeline";
import { TopBar } from "../components/TopBar";
import { useEditorSettings } from "../hooks/useEditorSettings";
import { useEditorShortcuts } from "../hooks/useEditorShortcuts";
import { openLicenseDialog, openLicensePricing, useLicense } from "../hooks/useLicense";
import { useProjectMedia } from "../hooks/useProjectMedia";
import { useSceneInputs } from "../hooks/useSceneInputs";
import { useTheme } from "../hooks/useTheme";
import { useAudioPlayback, usePlaybackClock } from "../playback/usePlayback";

function CenteredMessage({ children }: { children: string }) {
  return <div className="grid h-full place-items-center text-[13px] text-muted-foreground">{children}</div>;
}

export function EditorPage({ projectId, onHome }: { projectId: ProjectId; onHome: () => void }) {
  const state = useProjectMedia(projectId);
  if (state.status === "loading") return <CenteredMessage>Loading recording…</CenteredMessage>;
  if (state.status === "error") return <CenteredMessage>{state.message}</CenteredMessage>;
  return <Editor media={state.media} onHome={onHome} />;
}

function Editor({ media, onHome }: { media: ProjectMedia; onHome: () => void }) {
  const [project, setProject] = useState(media.project);
  const { settings, update, undo, redo, canUndo, canRedo } = useEditorSettings(project);
  const { inputs, reloadWallpaper } = useSceneInputs(media, settings);
  const { theme, toggleTheme } = useTheme();
  const { license, loading: licenseLoading } = useLicense();
  const licensed = licenseLoading || license !== null;
  const trim = trimmedRange(settings, project.duration);
  const clock = usePlaybackClock(trim.start, trim.end);
  useAudioPlayback(clock, media.audio, settings.audio);
  const [exportOpen, setExportOpen] = useState(false);
  useEditorShortcuts(clock, undo, redo);

  const uploadWallpaper = useCallback(async (file: File) => {
    await putAsset({ projectId: project.id, key: CUSTOM_WALLPAPER_ASSET_KEY, blob: file });
    update({ background: { kind: "image", wallpaper: CUSTOM_WALLPAPER } });
    reloadWallpaper();
  }, [project.id, update, reloadWallpaper]);

  const renderPanel = (tab: SidebarTab) => {
    switch (tab) {
      case "cursor":
        return <CursorPanel cursor={settings.cursor} onChange={update} />;
      case "camera":
        return <CameraPanel hasCamera={media.camera !== null} camera={settings.camera} onChange={update} />;
      case "audio":
        return <AudioPanel tracks={media.audio} audio={settings.audio} onChange={update} />;
      case "ratio":
        return <RatioPanel aspectRatio={settings.aspectRatio} source={media.source} backgroundEnabled={settings.background.enabled} onChange={update} />;
      case "background":
        return <BackgroundPanel background={settings.background} onChange={update} onUploadWallpaper={(file) => void uploadWallpaper(file)} />;
    }
  };

  return (
    <div className="screenix-editor flex h-full flex-col overflow-hidden bg-background">
      <TopBar
        projectName={project.name}
        onRename={(name) => setProject((current) => ({ ...current, name }))}
        onHome={onHome}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        theme={theme}
        onToggleTheme={toggleTheme}
        licensed={licensed}
        onRemoveWatermark={openLicensePricing}
        onEnterLicenseKey={openLicenseDialog}
        onExport={() => setExportOpen(true)}
      />
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] bg-[var(--editor-workspace-background)]">
        <div className="flex min-h-0">
          <section className="order-1 flex min-w-0 flex-1 flex-col px-3 pb-2 pt-3">
            {inputs ? <PreviewPane media={media} inputs={inputs} clock={clock} /> : <CenteredMessage>Preparing preview…</CenteredMessage>}
          </section>
          <Sidebar renderPanel={renderPanel} />
        </div>
        <Timeline
          clock={clock}
          duration={project.duration}
          trim={trim}
          onTrimChange={(next) => update({ trim: next }, "trim")}
        />
      </div>
      {inputs && <ExportDialog open={exportOpen} onOpenChange={setExportOpen} media={{ ...media, project }} inputs={inputs} license={license} />}
    </div>
  );
}
