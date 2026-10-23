import { IconArrowBackUp } from "@tabler/icons-react";
import { useMemo } from "react";
import { displayUrl } from "@/render/browserBar";
import type { SettingsPatch } from "@/shared/settings";
import type { PageVisit } from "@/shared/types";
import { formatClock } from "../../lib/format";
import { editPageUrl, recordedPages } from "../../lib/pageUrls";
import { ActionButton, Section } from "../controls";

function shownAs(url: string, showDetails: boolean): string {
  const { host, path } = displayUrl(url, showDetails);
  return `${host}${path}`;
}

export function PagesPanel({ visits, urls, frameOn, showUrlDetails, onChange, onSeek, onOpenBackground }: {
  visits: readonly PageVisit[];
  urls: Readonly<Record<string, string>>;
  frameOn: boolean;
  showUrlDetails: boolean;
  onChange: (patch: SettingsPatch, coalesceKey?: string) => void;
  onSeek: (time: number) => void;
  onOpenBackground: () => void;
}) {
  const pages = useMemo(() => recordedPages(visits), [visits]);

  if (pages.length === 0) {
    return (
      <Section title="Pages">
        <p className="text-[11px] leading-snug text-muted-foreground">This recording has no page addresses.</p>
      </Section>
    );
  }

  return (
    <div className="space-y-5">
      {!frameOn && (
        <Section title="Browser frame">
          <p className="text-[11px] leading-snug text-muted-foreground">
            The browser frame is off, so these addresses aren't shown in the video.
          </p>
          <ActionButton className="h-8 w-full" onClick={onOpenBackground}>Open Background</ActionButton>
        </Section>
      )}

      <Section title="Pages" onReset={() => onChange({ pageUrls: {} })} resetDisabled={Object.keys(urls).length === 0}>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Edit an address to change what the browser frame shows. Leave it empty to hide it.
        </p>
        {pages.map(({ url: recorded, times }) => {
          const url = urls[recorded] ?? recorded;
          const shown = shownAs(url, showUrlDetails);
          return (
            <div key={recorded} className="space-y-1.5 rounded-lg border p-2.5">
              <div className="flex items-center gap-1">
                {times.map((time) => (
                  <button
                    key={time}
                    type="button"
                    title="Go to this moment"
                    className="rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                    onClick={() => onSeek(time)}
                  >
                    {formatClock(time)}
                  </button>
                ))}
                {url !== recorded && (
                  <button
                    type="button"
                    title="Restore the recorded address"
                    aria-label="Restore the recorded address"
                    className="ml-auto grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                    onClick={() => onChange({ pageUrls: editPageUrl(urls, recorded, recorded) })}
                  >
                    <IconArrowBackUp size={14} stroke={1.8} />
                  </button>
                )}
              </div>
              <input
                aria-label="Page address"
                className="sidebar-input h-8 w-full px-2.5 font-mono text-[11px]"
                value={url}
                placeholder="Hidden"
                spellCheck={false}
                onChange={(event) => onChange({ pageUrls: editPageUrl(urls, recorded, event.target.value) }, `pageUrls.${recorded}`)}
              />
              <p className="truncate text-[11px] text-muted-foreground" title={shown}>
                {shown ? `Shown as ${shown}` : "Hidden"}
              </p>
            </div>
          );
        })}
      </Section>
    </div>
  );
}
