import { IconChevronsLeft, IconChevronsRight, IconMusic, IconPhoto, IconPointer, IconVideo, IconWorld, IconZoomIn, type Icon } from "@tabler/icons-react";
import clsx from "clsx";
import { useState, type ReactNode } from "react";

export type SidebarTab = "zoom" | "cursor" | "camera" | "background" | "browser" | "audio";

const TABS: readonly { id: SidebarTab; label: string; icon: Icon }[] = [
  { id: "zoom", label: "Zoom", icon: IconZoomIn },
  { id: "cursor", label: "Cursor", icon: IconPointer },
  { id: "camera", label: "Camera", icon: IconVideo },
  { id: "background", label: "Background", icon: IconPhoto },
  { id: "browser", label: "Browser", icon: IconWorld },
  { id: "audio", label: "Audio", icon: IconMusic },
];

export function Sidebar({ activeTab, onTabChange, renderPanel }: {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  renderPanel: (tab: SidebarTab) => ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const active = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  if (collapsed) {
    return (
      <aside className="order-2 flex w-11 shrink-0 flex-col items-center gap-1 border-l pt-2.5 transition-[width] duration-200">
        <button
          type="button"
          title="Expand sidebar"
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent/70 hover:text-foreground"
          onClick={() => setCollapsed(false)}
        >
          <IconChevronsRight size={15} stroke={1.8} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="order-2 flex w-[420px] shrink-0 flex-col border-l transition-[width] duration-200">
      <div className="border-b px-3 pb-3 pt-2.5">
        <div className="flex h-7 items-center justify-between">
          <span className="text-[13px] font-semibold">{active.label}</span>
          <button
            type="button"
            title="Collapse sidebar"
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent/70 hover:text-foreground"
            onClick={() => setCollapsed(true)}
          >
            <IconChevronsLeft size={15} stroke={1.8} />
          </button>
        </div>
        <div role="tablist" className="mt-2 grid grid-cols-6 gap-0.5 rounded-lg bg-surface-1 p-1">
          {TABS.map(({ id, label, icon: TabIcon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === activeTab}
              className={clsx(
                "flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-medium tracking-tight",
                id === activeTab ? "gold-button" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
              onClick={() => onTabChange(id)}
            >
              <TabIcon size={18} stroke={1.8} />
              <span className="max-w-full truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{renderPanel(activeTab)}</div>
    </aside>
  );
}
