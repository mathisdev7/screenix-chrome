import { IconUpload } from "@tabler/icons-react";
import clsx from "clsx";
import { useRef } from "react";
import { WALLPAPERS, builtinWallpaper, builtinWallpaperValue, CUSTOM_WALLPAPER } from "@/render/wallpapers";
import { ActionButton } from "../controls";

export function WallpaperGrid({ value, onSelect, onUpload }: {
  value: string | null;
  onSelect: (value: string) => void;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = builtinWallpaper(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Wallpaper</span>
        <span className="truncate text-[11px] text-muted-foreground">
          {value === CUSTOM_WALLPAPER ? "Custom image" : selected?.name}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {WALLPAPERS.map((wallpaper) => (
          <button
            key={wallpaper.name}
            type="button"
            title={wallpaper.name}
            onClick={() => onSelect(builtinWallpaperValue(wallpaper))}
            className={clsx(
              "relative aspect-video overflow-hidden rounded border-2 bg-surface-1 transition-all",
              selected === wallpaper ? "border-ring ring-1 ring-ring/30" : "border-transparent hover:border-surface-3",
            )}
          >
            <img src={wallpaper.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
          </button>
        ))}
      </div>
      <ActionButton onClick={() => inputRef.current?.click()}>
        <IconUpload size={15} stroke={1.8} />
        Choose from files…
      </ActionButton>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
