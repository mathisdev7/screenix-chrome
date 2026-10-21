import type { EditorSettings } from "@/shared/settings";
import { BackgroundLayer } from "./background";
import { paintCameraBubble } from "./cameraBubble";
import { drawClickEffects } from "./cursor/clickEffects";
import { CursorPainter } from "./cursor/cursorPainter";
import { cursorStateAt } from "./cursor/cursorState";
import type { CursorSprites } from "./cursor/theme";
import type { CursorTimeline } from "./cursor/timeline";
import { croppedSize, frameRectFor, referenceScale, roundedShapePath, uncroppedRect, videoRectFor, type Rect, type Size } from "./geometry";
import type { ZoomSource, ZoomView } from "./zoom/zoomCamera";

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

const SHADOW_OFFSCREEN_SHIFT = 100_000;
const SHADOW_COLOR = "rgba(0,0,0,0.34)";
const GLASS_BACKDROP_BLUR = 12;

export interface SceneInputs {
  settings: EditorSettings;
  source: Size;
  timeline: CursorTimeline;
  zoom: ZoomSource;
  sprites: CursorSprites;
  zoomSprites?: CursorSprites | null;
  wallpaper: ImageBitmap | null;
}

function applyZoom(ctx: Context2D, video: Rect, { scale, centerX, centerY }: ZoomView) {
  if (scale <= 1) return;
  ctx.translate(video.x + video.width / 2, video.y + video.height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-(video.x + centerX * video.width), -(video.y + centerY * video.height));
}

interface Backdrop {
  key: string;
  wallpaper: ImageBitmap | null;
  canvas: OffscreenCanvas;
}

export class Compositor {
  private readonly cursorPainter = new CursorPainter();
  private readonly backgroundLayer = new BackgroundLayer();
  private backdrop: Backdrop | null = null;

  constructor(private inputs: SceneInputs) {}

  update(inputs: SceneInputs) {
    this.inputs = inputs;
  }

  render(ctx: Context2D, output: Size, time: number, frame: ImageBitmap | null, camera: ImageBitmap | null = null) {
    const { settings, source } = this.inputs;
    const background = settings.background;
    const scale = referenceScale(output);
    const video = videoRectFor(output, croppedSize(source, settings.crop), background);
    const radius = background.enabled ? background.cornerRadius * scale : 0;
    const shape = roundedShapePath(video, radius, background.squircle);

    const zoom = this.inputs.zoom.at(time);
    const zoomScene = background.enabled && !background.zoomInsideFrame;

    ctx.save();
    ctx.clearRect(0, 0, output.width, output.height);
    ctx.save();
    if (zoomScene) applyZoom(ctx, video, zoom);
    if (background.enabled) ctx.drawImage(this.backdropFor(output, video, radius, scale), 0, 0);

    ctx.save();
    ctx.clip(shape);
    ctx.fillStyle = "#000";
    ctx.fillRect(video.x, video.y, video.width, video.height);
    if (!zoomScene) applyZoom(ctx, video, zoom);
    const fullVideo = uncroppedRect(video, settings.crop);
    const frameRect = frame ? frameRectFor(fullVideo, frame, background) : fullVideo;
    if (frame) ctx.drawImage(frame, frameRect.x, frameRect.y, frameRect.width, frameRect.height);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(video.x, video.y, video.width, video.height);
    ctx.clip();
    if (!zoomScene) applyZoom(ctx, video, zoom);
    const { cursor } = settings;
    drawClickEffects(ctx, this.inputs.timeline.clicks, time, cursor.clickEffect, cursor.clickEffectIntensity, frameRect);
    const sprites = zoom.scale > 1 && this.inputs.zoomSprites ? this.inputs.zoomSprites : this.inputs.sprites;
    this.paintCursor(ctx, time, frameRect, frame?.width ?? source.width, sprites);
    ctx.restore();
    ctx.restore();

    if (camera && settings.camera.enabled) paintCameraBubble(ctx, output, settings.camera, camera);
    ctx.restore();
  }

  private backdropFor(output: Size, video: Rect, radius: number, scale: number): OffscreenCanvas {
    const { settings, wallpaper } = this.inputs;
    const key = JSON.stringify([output.width, output.height, video, radius, scale, settings.background]);
    if (this.backdrop?.key === key && this.backdrop.wallpaper === wallpaper) return this.backdrop.canvas;
    const canvas = new OffscreenCanvas(output.width, output.height);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(this.backgroundLayer.get(output, settings.background, wallpaper), 0, 0);
      this.paintShadow(ctx, video, radius, scale);
      this.paintGlassBorder(ctx, output, video, radius, scale);
    }
    this.backdrop = { key, wallpaper, canvas };
    return canvas;
  }

  private paintShadow(ctx: Context2D, video: Rect, radius: number, scale: number) {
    const blur = this.inputs.settings.background.shadowBlur;
    if (blur <= 0) return;
    const spread = Math.max(4, Math.round(blur * 0.12)) * scale;
    const spreadRect = { x: video.x - spread, y: video.y - spread, width: video.width + spread * 2, height: video.height + spread * 2 };
    const deviceScale = ctx.getTransform().a;
    ctx.save();
    ctx.shadowColor = SHADOW_COLOR;
    ctx.shadowBlur = Math.max(34, Math.round(blur * 1.2)) * scale * deviceScale;
    ctx.shadowOffsetX = SHADOW_OFFSCREEN_SHIFT * deviceScale;
    ctx.shadowOffsetY = Math.max(18, Math.round(blur * 0.55)) * scale * deviceScale;
    ctx.translate(-SHADOW_OFFSCREEN_SHIFT, 0);
    ctx.fillStyle = "#000";
    ctx.fill(roundedShapePath(spreadRect, radius + spread, this.inputs.settings.background.squircle));
    ctx.restore();
  }

  private paintGlassBorder(ctx: Context2D, output: Size, video: Rect, radius: number, scale: number) {
    const { glassBorderWidth, glassBorderOpacity, squircle } = this.inputs.settings.background;
    if (glassBorderWidth <= 0) return;
    const width = Math.max(1, glassBorderWidth * scale);
    const outer = { x: video.x - width, y: video.y - width, width: video.width + width * 2, height: video.height + width * 2 };
    ctx.save();
    ctx.clip(roundedShapePath(outer, radius + width, squircle));
    ctx.filter = `blur(${GLASS_BACKDROP_BLUR * scale * ctx.getTransform().a}px) saturate(1.15)`;
    ctx.drawImage(this.backgroundLayer.get(output, this.inputs.settings.background, this.inputs.wallpaper), 0, 0);
    ctx.filter = "none";
    ctx.fillStyle = `rgba(255,255,255,${glassBorderOpacity})`;
    ctx.fillRect(outer.x, outer.y, outer.width, outer.height);
    ctx.restore();
  }

  private paintCursor(ctx: Context2D, time: number, frameRect: Rect, sourceWidth: number, sprites: CursorSprites) {
    const settings = this.inputs.settings.cursor;
    const state = cursorStateAt(this.inputs.timeline, time, settings);
    if (!state) return;
    const sprite = sprites[state.shape];
    const width = (settings.size / 100) * frameRect.width;
    const hotspotX = sprite.hotspot[0] * width;
    const hotspotY = sprite.hotspot[1] * width;
    const x = frameRect.x + state.x * frameRect.width - hotspotX;
    const y = frameRect.y + state.y * frameRect.height - hotspotY;
    const previousX = frameRect.x + state.previousX * frameRect.width - hotspotX;
    const previousY = frameRect.y + state.previousY * frameRect.height - hotspotY;
    const trail = Math.max(0, Math.min(1, settings.motionBlur));

    this.cursorPainter.paint(ctx, {
      sprite,
      x,
      y,
      width,
      scale: state.scale,
      rotationDeg: state.rotationDeg,
      motionX: (x - previousX) * trail,
      motionY: (y - previousY) * trail,
      pixelScale: frameRect.width / Math.max(1, sourceWidth),
      opacity: state.opacity,
      shadowBlur: settings.shadow > 0 ? Math.max(2, width * 0.12) : 0,
      shadowColor: `rgba(0,0,0,${settings.shadow.toFixed(2)})`,
    });
  }
}
