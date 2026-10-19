export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  return seconds < 60 ? `${seconds.toFixed(1)}s` : formatClock(seconds);
}

export function fileNameFor(projectName: string, extension: string): string {
  const base = projectName.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "Screenix recording";
  return `${base}.${extension}`;
}
