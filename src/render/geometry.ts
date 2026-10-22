import type { AspectRatioId, BackgroundSettings, CropRect, EditorSettings } from "@/shared/settings";

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  x: number;
  y: number;
}

export interface AspectRatioOption {
  id: AspectRatioId;
  label: string;
  ratio: readonly [number, number] | null;
}

export const ASPECT_RATIOS: readonly AspectRatioOption[] = [
  { id: "source", label: "Source", ratio: null },
  { id: "16:9", label: "16:9", ratio: [16, 9] },
  { id: "9:16", label: "9:16", ratio: [9, 16] },
  { id: "1:1", label: "1:1", ratio: [1, 1] },
  { id: "4:5", label: "4:5", ratio: [4, 5] },
  { id: "4:3", label: "4:3", ratio: [4, 3] },
];

const REFERENCE_SIZE: Size = { width: 1920, height: 1080 };

export function aspectValue(id: AspectRatioId, source: Size): number {
  const ratio = ASPECT_RATIOS.find((option) => option.id === id)?.ratio;
  if (ratio) return ratio[0] / ratio[1];
  return source.height > 0 ? source.width / source.height : 16 / 9;
}

export function croppedSize(source: Size, crop: CropRect): Size {
  return { width: source.width * crop.width, height: source.height * crop.height };
}

const BROWSER_BAR_RATIO = 0.032;

function browserBarRatio(background: BackgroundSettings): number {
  return background.browserFrame === "off" ? 0 : BROWSER_BAR_RATIO;
}

function browserBarHeight(width: number, background: BackgroundSettings): number {
  return Math.round(width * browserBarRatio(background));
}

export function outputAspect(settings: EditorSettings, source: Size): number {
  const aspect = aspectValue(settings.aspectRatio, croppedSize(source, settings.crop));
  if (settings.aspectRatio !== "source" || settings.background.enabled) return aspect;
  return aspect / (1 + aspect * browserBarRatio(settings.background));
}

export function uncroppedRect(visible: Rect, crop: CropRect): Rect {
  const width = visible.width / crop.width;
  const height = visible.height / crop.height;
  return { x: visible.x - crop.x * width, y: visible.y - crop.y * height, width, height };
}

const ENCODER_WIDTH_ALIGNMENT = 16;
const ENCODER_HEIGHT_ALIGNMENT = 8;

function align(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

export function alignedSizeWithin(size: Size): Size {
  const alignDown = (value: number, step: number) => Math.max(step, Math.floor(value / step) * step);
  return { width: alignDown(size.width, ENCODER_WIDTH_ALIGNMENT), height: alignDown(size.height, ENCODER_HEIGHT_ALIGNMENT) };
}

export function encoderSizeForShortSide(aspect: number, shortSide: number): Size {
  if (aspect >= 1) {
    const height = align(shortSide, ENCODER_HEIGHT_ALIGNMENT);
    return { width: align(height * aspect, ENCODER_WIDTH_ALIGNMENT), height };
  }
  const width = align(shortSide, ENCODER_WIDTH_ALIGNMENT);
  return { width, height: align(width / aspect, ENCODER_HEIGHT_ALIGNMENT) };
}

export function containRect(container: Rect, content: Size): Rect {
  const scale = Math.min(container.width / content.width, container.height / content.height);
  return centeredRect(container, content, scale);
}

export function coverRect(container: Rect, content: Size): Rect {
  const scale = Math.max(container.width / content.width, container.height / content.height);
  return centeredRect(container, content, scale);
}

function centeredRect(container: Rect, content: Size, scale: number): Rect {
  const width = content.width * scale;
  const height = content.height * scale;
  return {
    x: container.x + (container.width - width) / 2,
    y: container.y + (container.height - height) / 2,
    width,
    height,
  };
}

export function insetRect(rect: Rect, amount: number): Rect {
  return { x: rect.x + amount, y: rect.y + amount, width: rect.width - amount * 2, height: rect.height - amount * 2 };
}

export function referenceScale(output: Size): number {
  return Math.min(output.width / REFERENCE_SIZE.width, output.height / REFERENCE_SIZE.height);
}

export function videoRectFor(output: Size, source: Size, background: BackgroundSettings): Rect {
  if (!background.enabled) {
    const bar = browserBarHeight(output.width, background);
    return { x: 0, y: bar, width: output.width, height: output.height - bar };
  }
  const sourceAspect = source.width / source.height;
  const width = Math.min(background.screenScale * output.width, output.height / (1 / sourceAspect + browserBarRatio(background)));
  const bar = browserBarHeight(width, background);
  const outer = centeredRect({ x: 0, y: 0, ...output }, { width, height: width / sourceAspect + bar }, 1);
  return { ...outer, y: outer.y + bar, height: width / sourceAspect };
}

export function windowRectFor(video: Rect, background: BackgroundSettings): Rect {
  const bar = browserBarHeight(video.width, background);
  return { ...video, y: video.y - bar, height: video.height + bar };
}

const FILL_ASPECT_TOLERANCE = 0.15;
const PIXEL_EXACT_TOLERANCE = 0.01;

function pixelExactCoverRect(container: Rect, content: Size): Rect {
  const cover = { ...coverRect(container, content), y: container.y };
  const scale = cover.width / content.width;
  if (scale > 1 || scale < 1 - PIXEL_EXACT_TOLERANCE) return cover;
  return {
    x: Math.round(container.x + (container.width - content.width) / 2),
    y: Math.round(container.y),
    width: content.width,
    height: content.height,
  };
}

export function frameRectFor(video: Rect, frame: Size, background: BackgroundSettings): Rect {
  if (!background.enabled) return pixelExactCoverRect(video, frame);
  const aspectMismatch = (frame.width / frame.height) / (video.width / video.height) - 1;
  if (Math.abs(aspectMismatch) > FILL_ASPECT_TOLERANCE) return containRect(video, frame);
  return { ...coverRect(video, frame), y: video.y };
}

export function roundedShapePath(rect: Rect, radius: number, squircle: boolean): Path2D {
  const path = new Path2D();
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));
  if (r === 0) {
    path.rect(rect.x, rect.y, rect.width, rect.height);
    return path;
  }
  if (!squircle) {
    path.roundRect(rect.x, rect.y, rect.width, rect.height, r);
    return path;
  }

  const pointsPerCorner = 18;
  const exponent = 2 / 4;
  const corners = [
    { cx: rect.x + rect.width - r, cy: rect.y + r, start: -Math.PI / 2 },
    { cx: rect.x + rect.width - r, cy: rect.y + rect.height - r, start: 0 },
    { cx: rect.x + r, cy: rect.y + rect.height - r, start: Math.PI / 2 },
    { cx: rect.x + r, cy: rect.y + r, start: Math.PI },
  ];
  let first = true;
  for (const corner of corners) {
    for (let i = 0; i <= pointsPerCorner; i++) {
      const angle = corner.start + (Math.PI / 2) * (i / pointsPerCorner);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = corner.cx + r * Math.sign(cos) * Math.pow(Math.abs(cos), exponent);
      const y = corner.cy + r * Math.sign(sin) * Math.pow(Math.abs(sin), exponent);
      if (first) path.moveTo(x, y);
      else path.lineTo(x, y);
      first = false;
    }
  }
  path.closePath();
  return path;
}
