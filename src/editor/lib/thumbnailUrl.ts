const thumbnailUrls = new WeakMap<Blob, string>();

export function thumbnailUrl(blob: Blob): string {
  let url = thumbnailUrls.get(blob);
  if (!url) {
    url = URL.createObjectURL(blob);
    thumbnailUrls.set(blob, url);
  }
  return url;
}
