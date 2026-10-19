import { useCallback, useMemo, useState } from "react";
import { TimeMap } from "@/render/timeMap";
import type { ProjectMedia } from "@/render/projectMedia";
import { CUSTOM_WALLPAPER, CUSTOM_WALLPAPER_ASSET_KEY } from "@/render/wallpapers";
import { putAsset } from "@/shared/db";
import type { ZoomClip } from "@/shared/settings";
import type { ProjectId, ProjectShare } from "@/shared/types";
import { ExportDialog } from "../components/ExportDialog";
import { ManageShareDialog } from "../components/ManageShareDialog";
import { ShareDialog } from "../components/ShareDialog";
import { PreviewPane } from "../components/preview/PreviewPane";
import { AudioPanel } from "../components/sidebar/AudioPanel";
import { BackgroundPanel } from "../components/sidebar/BackgroundPanel";
import { CameraPanel } from "../components/sidebar/CameraPanel";
import { CursorPanel } from "../components/sidebar/CursorPanel";
import { RatioPanel } from "../components/sidebar/RatioPanel";
import { ZoomPanel } from "../components/sidebar/ZoomPanel";
import { Sidebar, type SidebarTab } from "../components/sidebar/Sidebar";
import { Timeline } from "../components/timeline/Timeline";
import { TopBar } from "../components/TopBar";
import { useEditorSettings } from "../hooks/useEditorSettings";
import { useEditorShortcuts } from "../hooks/useEditorShortcuts";
import { useCameraImport } from "../hooks/useCameraImport";
import { addZoomClip, autoZoomClips, zoomClipAt } from "../lib/zoomClips";
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
  const createAutoZoom = useCallback(
    () => autoZoomClips(media.pointer, media.project.duration, () => crypto.randomUUID()),
    [media.pointer, media.project.duration],
  );
  const { settings, update, undo, redo, canUndo, canRedo } = useEditorSettings(project, createAutoZoom);
  const { inputs, reloadWallpaper } = useSceneInputs(media, settings);
  const { theme, toggleTheme } = useTheme();
  const { license, loading: licenseLoading } = useLicense();
  const licensed = licenseLoading || license !== null;
  const { trim, speed } = settings;
  const timeMap = useMemo(() => TimeMap.from(trim, speed, project.duration), [trim, speed, project.duration]);
  const clock = usePlaybackClock(timeMap);
  const changeSpeed = useCallback((next: typeof speed, coalesceKey?: string) => update({ speed: next }, coalesceKey), [update]);
  const changeZoom = useCallback((next: ZoomClip[], coalesceKey?: string) => update({ zoom: next }, coalesceKey), [update]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("cursor");
  const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
  const hasClicks = useMemo(() => media.pointer.some((sample) => sample.kind === "down"), [media.pointer]);

  const selectZoom = useCallback((id: string | null) => {
    setSelectedZoomId(id);
    if (id) setSidebarTab("zoom");
  }, []);

  const addZoom = () => {
    const existing = zoomClipAt(settings.zoom, clock.time);
    if (existing) {
      selectZoom(existing.id);
      return;
    }
    const id = crypto.randomUUID();
    const next = addZoomClip(settings.zoom, clock.time, { start: timeMap.sourceStart, end: timeMap.sourceEnd }, id);
    if (!next) return;
    changeZoom(next);
    selectZoom(id);
  };

  const autoZoom = () => {
    changeZoom(createAutoZoom());
    selectZoom(null);
  };
  useAudioPlayback(clock, media.audio, settings.audio);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareDialog, setShareDialog] = useState<{ mode: "share" } | { mode: "manage"; share: ProjectShare } | null>(null);
  useEditorShortcuts(clock, undo, redo);
  const cameraImport = useCameraImport(project, settings);
  const setShare = useCallback((share: ProjectShare | null) => setProject((current) => ({ ...current, share })), []);

  const uploadWallpaper = useCallback(async (file: File) => {
    await putAsset({ projectId: project.id, key: CUSTOM_WALLPAPER_ASSET_KEY, blob: file });
    update({ background: { kind: "image", wallpaper: CUSTOM_WALLPAPER } });
    reloadWallpaper();
  }, [project.id, update, reloadWallpaper]);

  const renderPanel = (tab: SidebarTab) => {
    switch (tab) {
      case "cursor":
        return <CursorPanel cursor={settings.cursor} onChange={update} />;
      case "zoom":
        return (
          <ZoomPanel
            clips={settings.zoom}
            selectedId={selectedZoomId}
            source={media.source}
            thumbnail={project.thumbnail}
            canAutoZoom={hasClicks}
            onAdd={addZoom}
            onAutoZoom={autoZoom}
            onSelect={selectZoom}
            onChange={changeZoom}
          />
        );
      case "camera":
        return (
          <CameraPanel
            hasCamera={media.camera !== null}
            camera={settings.camera}
            importState={cameraImport.state}
            onImportVideo={(file) => void cameraImport.importVideo(file)}
            onChange={update}
          />
        );
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
        shared={Boolean(project.share)}
        onShare={() => setShareDialog(project.share ? { mode: "manage", share: project.share } : { mode: "share" })}
        onExport={() => setExportOpen(true)}
      />
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] bg-[var(--editor-workspace-background)]">
        <div className="flex min-h-0">
          <section className="order-1 flex min-w-0 flex-1 flex-col px-3 pb-2 pt-3">
            {inputs ? <PreviewPane media={media} inputs={inputs} clock={clock} onChange={update} /> : <CenteredMessage>Preparing preview…</CenteredMessage>}
          </section>
          <Sidebar activeTab={sidebarTab} onTabChange={setSidebarTab} renderPanel={renderPanel} />
        </div>
        <Timeline
          clock={clock}
          duration={project.duration}
          map={timeMap}
          speed={speed}
          zoomClips={settings.zoom}
          selectedZoomId={selectedZoomId}
          onTrimChange={(next) => update({ trim: next }, "trim")}
          onSpeedChange={changeSpeed}
          onZoomChange={changeZoom}
          onSelectZoom={selectZoom}
          onAddZoom={addZoom}
        />
      </div>
      {shareDialog?.mode === "manage" && (
        <ManageShareDialog share={shareDialog.share} onDeleted={() => setShare(null)} onClose={() => setShareDialog(null)} />
      )}
      {shareDialog?.mode === "share" && inputs && (
        <ShareDialog media={{ ...media, project }} inputs={inputs} onShared={setShare} onClose={() => setShareDialog(null)} />
      )}
      {inputs && <ExportDialog open={exportOpen} onOpenChange={setExportOpen} media={{ ...media, project }} inputs={inputs} license={license} onShared={setShare} />}
    </div>
  );
}
