const STORAGE_KEY = "cameraBubbleStyle";

export interface CameraBubbleStyle {
  x: number;
  y: number;
  size: number;
  roundness: number;
}

export interface PageCameraBubble {
  url: string;
  style: CameraBubbleStyle;
}

export const CAMERA_BUBBLE_MIN_SIZE = 120;
export const CAMERA_BUBBLE_MAX_SIZE = 400;

export const DEFAULT_CAMERA_BUBBLE_STYLE: CameraBubbleStyle = { x: 0, y: 1, size: 200, roundness: 1 };

function withDefaults(style: Partial<CameraBubbleStyle> | undefined): CameraBubbleStyle {
  return { ...DEFAULT_CAMERA_BUBBLE_STYLE, ...style };
}

export async function readCameraBubbleStyle(): Promise<CameraBubbleStyle> {
  const stored = await chrome.storage.local.get(STORAGE_KEY).catch((): Record<string, unknown> => ({}));
  return withDefaults(stored[STORAGE_KEY] as Partial<CameraBubbleStyle> | undefined);
}

export async function writeCameraBubbleStyle(style: CameraBubbleStyle): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: style });
}

export function onCameraBubbleStyleChanged(listener: (style: CameraBubbleStyle) => void): () => void {
  const handle = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "local" && STORAGE_KEY in changes) listener(withDefaults(changes[STORAGE_KEY].newValue as Partial<CameraBubbleStyle> | undefined));
  };
  chrome.storage.onChanged.addListener(handle);
  return () => chrome.storage.onChanged.removeListener(handle);
}
