import { Dialog } from "@base-ui/react/dialog";
import { IconX } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import type { SceneInputs } from "@/render/compositor";
import type { ProjectMedia } from "@/render/projectMedia";
import type { ProjectShare } from "@/shared/types";
import { useProgressWindow } from "../hooks/useProgressWindow";
import { isSharing, useShareLink } from "../hooks/useShareLink";
import { ActionButton } from "./controls";
import { ProgressWindow } from "./ProgressWindow";
import { ShareStatus } from "./ShareStatus";

const SECONDARY_BUTTON = "min-h-[38px] w-full rounded-[9px] border px-3 text-[12px] font-medium transition-colors hover:bg-accent/70 disabled:opacity-45";

export function ShareDialog({ media, inputs, onShared, onClose }: {
  media: ProjectMedia;
  inputs: SceneInputs;
  onShared: (share: ProjectShare) => void;
  onClose: () => void;
}) {
  const shareLink = useShareLink(media, inputs, onShared);
  const { shareProject, reset } = shareLink;
  const state = shareLink.state;
  const lifecycle = useRef({ shareProject, reset });
  const progressWindow = useProgressWindow();
  const { open: openProgressWindow, close: closeProgressWindow } = progressWindow;
  const rendering = state.status === "rendering";

  useEffect(() => {
    const { shareProject: start, reset: stop } = lifecycle.current;
    void start();
    return stop;
  }, []);

  useEffect(() => {
    if (rendering) void openProgressWindow();
    else closeProgressWindow();
  }, [rendering, openProgressWindow, closeProgressWindow]);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Popup className="screenix-editor fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border bg-background p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-[15px] font-semibold">Share link</Dialog.Title>
            <Dialog.Close className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent/70 hover:text-foreground" aria-label="Close">
              <IconX size={15} stroke={1.8} />
            </Dialog.Close>
          </div>
          <ShareStatus share={state} />
          {state.status === "rendering" && progressWindow.target && (
            <ProgressWindow target={progressWindow.target} label="Rendering" progress={state.progress} onCancel={onClose} />
          )}
          <div className="flex gap-2">
            {isSharing(state) && <ActionButton variant="danger" onClick={onClose}>Cancel</ActionButton>}
            {state.status === "shared" && (
              <>
                <ActionButton onClick={() => void shareLink.copy()}>Copy link</ActionButton>
                <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>Done</button>
              </>
            )}
            {state.status === "failed" && (
              <>
                {!state.needsPlan && <ActionButton onClick={() => void shareProject()}>Try again</ActionButton>}
                <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>Close</button>
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
