import { useCallback, useEffect, useMemo, useState } from "react";
import type { SceneInputs } from "@/render/compositor";
import { loadCursorSprites, type CursorSprites } from "@/render/cursor/theme";
import { buildCursorTimeline } from "@/render/cursor/timeline";
import type { ProjectMedia } from "@/render/projectMedia";
import { loadWallpaper } from "@/render/wallpapers";
import { ZoomTimeline } from "@/render/zoom/zoomTimeline";
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

export function useSceneInputs(media: ProjectMedia, settings: EditorSettings) {
  const sprites = useCursorSprites(settings.cursor.theme);
  const wallpaper = useWallpaperImage(media, settings);
  const timeline = useMemo(
    () => buildCursorTimeline(media.pointer, settings.cursor.speed),
    [media.pointer, settings.cursor.speed],
  );

  const zoom = useMemo(
    () => ZoomTimeline.build(settings.zoom, timeline.raw, media.project.duration),
    [settings.zoom, timeline.raw, media.project.duration],
  );

  const inputs = useMemo((): SceneInputs | null => (
    sprites ? { settings, source: media.source, timeline, zoom, sprites, wallpaper: wallpaper.image } : null
  ), [settings, media.source, timeline, zoom, sprites, wallpaper.image]);

  return { inputs, reloadWallpaper: wallpaper.reload };
}
