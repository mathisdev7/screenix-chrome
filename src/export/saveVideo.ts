const OBJECT_URL_LIFETIME_MS = 5 * 60 * 1000;

export type SaveResult = { status: "saved"; fileName: string } | { status: "canceled" };

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export async function saveVideoFile(blob: Blob, fileName: string): Promise<SaveResult> {
  const url = URL.createObjectURL(blob);
  setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
  try {
    const downloadId = await chrome.downloads.download({ url, filename: fileName, saveAs: true });
    const [item] = await chrome.downloads.search({ id: downloadId });
    return { status: "saved", fileName: item?.filename ? baseName(item.filename) : fileName };
  } catch (error) {
    if (String(error).toLowerCase().includes("cancel")) return { status: "canceled" };
    throw error;
  }
}
