import { getAsset } from "@/shared/db";
import type { ProjectId } from "@/shared/types";

export interface Wallpaper {
  name: string;
  url: string;
  thumbUrl: string;
}

const WALLPAPERS_BASE_URL = "https://cdn.usearctic.sh/wallpapers";
const WALLPAPER_THUMBS_BASE_URL = "https://cdn.usearctic.sh/wallpaper-thumbs";
const BUILTIN_PREFIX = "builtin:";
export const CUSTOM_WALLPAPER = "custom";
export const CUSTOM_WALLPAPER_ASSET_KEY = "wallpaper";

const WALLPAPER_FILES: readonly (readonly [name: string, file: string])[] = [
  ["Adrian Infernus", "adrian-infernus-GLf7bAwCdYg-unsplash"],
  ["Aperture Vintage Blue", "aperture-vintage-BcceGzBmeTI-unsplash"],
  ["Aperture Vintage Glow", "aperture-vintage-NrAvSjyW3D4-unsplash"],
  ["MacBook Pro Dark", "apple-macbook-pro-stock-2021-apple-event-2021-dark-mode-6016x5468-6759"],
  ["Bolivia Inteligente", "boliviainteligente-37WxvlfW3to-unsplash"],
  ["Magic Pattern", "magicpattern-87PP9Zd7MNo-unsplash"],
  ["Martin Martz Bloom", "martin-martz-7Zou5Z2g72U-unsplash"],
  ["Martin Martz Color", "martin-martz-HDM4lqjAV4s-unsplash"],
  ["Martin Martz Flow", "martin-martz-P66DWe8AAbo-unsplash"],
  ["Martin Martz Gradient", "martin-martz-X5fEKadz0Xc-unsplash"],
  ["Martin Martz Wave", "martin-martz-xA4v5VqLATs-unsplash"],
  ["Milad Fakurian Aura", "milad-fakurian-E8Ufcyxz514-unsplash"],
  ["Milad Fakurian Haze", "milad-fakurian-u8Jn2rzYIps-unsplash"],
  ["Pawel Czerwinski Color", "pawel-czerwinski-7FqOISWr5V0-unsplash"],
  ["Pawel Czerwinski Abstract", "pawel-czerwinski-YAtspJ-HV2E-unsplash"],
  ["Richard Horvath Neon", "richard-horvath-RAZU_R66vUc-unsplash"],
  ["Richard Horvath Prism", "richard-horvath-_nWaeTF6qo0-unsplash"],
  ["Richard Horvath Gradient", "richard-horvath-cPccYbPrF-A-unsplash"],
  ["Richard Horvath Glow", "richard-horvath-is8jWT-mvng-unsplash"],
  ["Sean Fahrenbruch", "sean-fahrenbruch-g95tsUeCohM-unsplash"],
];

const PAINTING_FILES: readonly (readonly [name: string, file: string])[] = [
  ["The Birth of Venus", "botticelli-birth-of-venus"],
  ["Primavera", "botticelli-primavera"],
  ["The School of Athens", "raphael-school-of-athens"],
  ["The Creation of Adam", "michelangelo-creation-of-adam"],
  ["Annunciation", "leonardo-annunciation"],
  ["The Hunters in the Snow", "bruegel-hunters-in-the-snow"],
  ["The Harvesters", "bruegel-harvesters"],
  ["The Tower of Babel", "bruegel-tower-of-babel"],
];

export const ABSTRACT_WALLPAPERS: readonly Wallpaper[] = WALLPAPER_FILES.map(([name, file]) => ({
  name,
  url: `${WALLPAPERS_BASE_URL}/${encodeURIComponent(`${file}.jpg`)}`,
  thumbUrl: `${WALLPAPER_THUMBS_BASE_URL}/${encodeURIComponent(`${file}-thumb.jpg`)}`,
}));

export const PAINTING_WALLPAPERS: readonly Wallpaper[] = PAINTING_FILES.map(([name, file]) => ({
  name,
  url: `/wallpapers/${file}.jpg`,
  thumbUrl: `/wallpaper-thumbs/${file}.jpg`,
}));

export const WALLPAPERS: readonly Wallpaper[] = [...ABSTRACT_WALLPAPERS, ...PAINTING_WALLPAPERS];

export const FEATURED_WALLPAPERS = WALLPAPERS.slice(0, 4);

export function builtinWallpaperValue(wallpaper: Wallpaper): string {
  return `${BUILTIN_PREFIX}${wallpaper.name}`;
}

export function builtinWallpaper(value: string | null): Wallpaper | undefined {
  if (!value?.startsWith(BUILTIN_PREFIX)) return undefined;
  const name = value.slice(BUILTIN_PREFIX.length);
  return WALLPAPERS.find((wallpaper) => wallpaper.name === name);
}

const MAX_WALLPAPER_SIDE = 4096;

const builtinCache = new Map<string, Promise<Blob>>();

function fetchBuiltin(wallpaper: Wallpaper): Promise<Blob> {
  let cached = builtinCache.get(wallpaper.url);
  if (!cached) {
    cached = fetch(wallpaper.url).then((response) => {
      if (!response.ok) throw new Error(`Wallpaper request failed with ${response.status}`);
      return response.blob();
    });
    cached.catch(() => builtinCache.delete(wallpaper.url));
    builtinCache.set(wallpaper.url, cached);
  }
  return cached;
}

async function decodeWallpaper(blob: Blob): Promise<ImageBitmap> {
  const image = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_WALLPAPER_SIDE / Math.max(image.width, image.height));
  const resized = await createImageBitmap(image, {
    resizeWidth: Math.round(image.width * scale),
    resizeHeight: Math.round(image.height * scale),
    resizeQuality: "high",
  });
  image.close();
  return resized;
}

export async function loadWallpaper(value: string | null, projectId: ProjectId): Promise<ImageBitmap | null> {
  if (value === CUSTOM_WALLPAPER) {
    const blob = await getAsset(projectId, CUSTOM_WALLPAPER_ASSET_KEY);
    return blob ? decodeWallpaper(blob) : null;
  }
  const wallpaper = builtinWallpaper(value);
  return wallpaper ? decodeWallpaper(await fetchBuiltin(wallpaper)) : null;
}
