import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserPages } from "@/render/browserBar";
import type { SceneInputs } from "@/render/compositor";
import { loadCursorSprites, type CursorSprites } from "@/render/cursor/theme";
import { buildCursorTimeline, type TimelinePoint } from "@/render/cursor/timeline";
import type { ProjectMedia } from "@/render/projectMedia";
import { loadWallpaper } from "@/render/wallpapers";
import { ZoomTimeline } from "@/render/zoom/zoomTimeline";
import type { CursorThemeId } from "@/shared/cursorThemes";
import type { CropRect, EditorSettings } from "@/shared/settings";

function toCropSpace(points: readonly TimelinePoint[], crop: CropRect): TimelinePoint[] {
  return points.map(({ t, x, y }) => ({ t, x: (x - crop.x) / crop.width, y: (y - crop.y) / crop.height }));
}

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
  const browser = useBrowserPages(media);
  const timeline = useMemo(
    () => buildCursorTimeline(media.pointer, settings.cursor.speed),
    [media.pointer, settings.cursor.speed],
  );

  const { crop } = settings;
  const zoom = useMemo(
    () => ZoomTimeline.build(settings.zoom, toCropSpace(timeline.raw, crop), media.project.duration),
    [settings.zoom, timeline.raw, crop, media.project.duration],
  );

  const inputs = useMemo((): SceneInputs | null => (
    sprites ? { settings, source: media.source, timeline, zoom, sprites, wallpaper: wallpaper.image, browser } : null
  ), [settings, media.source, timeline, zoom, sprites, wallpaper.image, browser]);

  return { inputs, reloadWallpaper: wallpaper.reload };
}
