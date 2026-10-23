import type { PageVisit } from "@/shared/types";

export interface RecordedPage {
  url: string;
  times: number[];
}

export function recordedPages(visits: readonly PageVisit[]): RecordedPage[] {
  const pages = new Map<string, RecordedPage>();
  let previous: string | null = null;
  for (const { t, url } of visits) {
    const page = pages.get(url) ?? { url, times: [] };
    pages.set(url, page);
    if (url !== previous) page.times.push(t);
    previous = url;
  }
  return [...pages.values()];
}

export function editPageUrl(urls: Readonly<Record<string, string>>, recorded: string, url: string): Record<string, string> {
  const next = { ...urls, [recorded]: url };
  if (url === recorded) delete next[recorded];
  return next;
}
