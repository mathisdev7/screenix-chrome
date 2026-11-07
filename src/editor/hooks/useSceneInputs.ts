import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserPages } from "@/render/browserBar";
import type { SceneInputs } from "@/render/compositor";
import { loadCursorSprites, type CursorSprites } from "@/render/cursor/theme";
import { buildCursorTimeline } from "@/render/cursor/timeline";
import type { ProjectMedia } from "@/render/projectMedia";
import { buildFollow, buildZoom, toCropSpace, visibleSize } from "@/render/sceneInputs";
import { loadWallpaper } from "@/render/wallpapers";
import type { CursorThemeId } from "@/shared/cursorThemes";
import type { EditorSettings } from "@/shared/settings";

function useCursorSprites(theme: CursorThemeId): CursorSprites | null {
  const [sprites, setSprites] = useState<CursorSprites | null>(null);
  useEffect(() => {
    let active = true;
    void loadCursorSprites(theme).then((loaded) => {
      if (active) setSprites(loaded);
    });
    return () => {
      active = false;
    };
  }, [theme]);
  return sprites;
}

function useWallpaperImage(media: ProjectMedia, settings: EditorSettings) {
  const { kind, wallpaper } = settings.background;
  const [revision, setRevision] = useState(0);
  const [image, setImage] = useState<ImageBitmap | null>(null);

  useEffect(() => {
    if (kind !== "image") return;
    let active = true;
    loadWallpaper(wallpaper, media.project.id)
      .catch(() => null)
      .then((loaded) => {
        if (active) setImage(loaded);
      });
    return () => {
      active = false;
    };
  }, [kind, wallpaper, revision, media.project.id]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { image: kind === "image" ? image : null, reload };
}

function useBrowserPages(media: ProjectMedia): BrowserPages {
  const [pages, setPages] = useState(BrowserPages.empty);
  useEffect(() => {
    let active = true;
    void BrowserPages.load(media.project.pages ?? []).then((loaded) => {
      if (active) setPages(loaded);
    });
    return () => {
      active = false;
    };
  }, [media.project.pages]);
  return pages;
}

export function useSceneInputs(media: ProjectMedia, settings: EditorSettings) {
  const sprites = useCursorSprites(settings.cursor.theme);
  const wallpaper = useWallpaperImage(media, settings);
  const recordedPages = useBrowserPages(media);
  const browser = useMemo(() => recordedPages.withUrls(settings.pageUrls), [recordedPages, settings.pageUrls]);
  const timeline = useMemo(
    () => buildCursorTimeline(media.pointer, settings.cursor.speed),
    [media.pointer, settings.cursor.speed],
  );

  const { crop } = settings;
  const { duration } = media.project;
  const points = useMemo(() => toCropSpace(timeline.raw, crop), [timeline.raw, crop]);
  const { width: visibleWidth, height: visibleHeight } = visibleSize(settings, media.source);
  const follow = useMemo(
    () => buildFollow(points, { width: visibleWidth, height: visibleHeight }, duration),
    [points, visibleWidth, visibleHeight, duration],
  );
  const zoom = useMemo(() => buildZoom(settings.zoom, points, follow, duration), [settings.zoom, points, follow, duration]);

  const inputs = useMemo((): SceneInputs | null => (
    sprites ? { settings, source: media.source, timeline, zoom, follow, sprites, wallpaper: wallpaper.image, browser } : null
  ), [settings, media.source, timeline, zoom, follow, sprites, wallpaper.image, browser]);

  return { inputs, reloadWallpaper: wallpaper.reload };
}
