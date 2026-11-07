import type { CropRect, EditorSettings, ZoomClip } from "@/shared/settings";
import { BrowserPages } from "./browserBar";
import type { SceneInputs } from "./compositor";
import { loadCursorSprites } from "./cursor/theme";
import { buildCursorTimeline, type TimelinePoint } from "./cursor/timeline";
import { visibleArea, type Size } from "./geometry";
import type { ProjectMedia } from "./projectMedia";
import { loadWallpaper } from "./wallpapers";
import { FollowTimeline } from "./zoom/followTimeline";
import { ZoomTimeline } from "./zoom/zoomTimeline";

export function toCropSpace(points: readonly TimelinePoint[], crop: CropRect): TimelinePoint[] {
  return points.map(({ t, x, y }) => ({ t, x: (x - crop.x) / crop.width, y: (y - crop.y) / crop.height }));
}

export function visibleSize(settings: EditorSettings, source: Size): Size {
  return visibleArea(settings, source) ?? { width: 1, height: 1 };
}

export function buildFollow(points: readonly TimelinePoint[], visible: Size, duration: number): FollowTimeline | null {
  return visible.width < 1 || visible.height < 1 ? FollowTimeline.build(points, visible, duration) : null;
}

export function buildZoom(clips: readonly ZoomClip[], points: readonly TimelinePoint[], follow: FollowTimeline | null, duration: number): ZoomTimeline {
  return follow ? ZoomTimeline.build(follow.windowClips(clips), follow.windowPoints(points), duration) : ZoomTimeline.build(clips, points, duration);
}

export async function loadSceneInputs(media: ProjectMedia, settings: EditorSettings): Promise<SceneInputs> {
  const { background } = settings;
  const [sprites, wallpaper, pages] = await Promise.all([
    loadCursorSprites(settings.cursor.theme),
    background.kind === "image" ? loadWallpaper(background.wallpaper, media.project.id).catch(() => null) : null,
    BrowserPages.load(media.project.pages ?? []),
  ]);
  const { duration } = media.project;
  const timeline = buildCursorTimeline(media.pointer, settings.cursor.speed);
  const points = toCropSpace(timeline.raw, settings.crop);
  const follow = buildFollow(points, visibleSize(settings, media.source), duration);
  const zoom = buildZoom(settings.zoom, points, follow, duration);
  return { settings, source: media.source, timeline, zoom, follow, sprites, wallpaper, browser: pages.withUrls(settings.pageUrls) };
}
