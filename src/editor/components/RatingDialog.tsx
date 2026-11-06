import { Dialog } from "@base-ui/react/dialog";
import { IconStarFilled, IconX } from "@tabler/icons-react";
import { useSyncExternalStore } from "react";
import { CHROME_WEB_STORE_REVIEWS_URL, claimRatingPrompt } from "@/shared/rating";
import { ActionButton } from "./controls";

const SECONDARY_BUTTON = "min-h-[38px] w-full rounded-[9px] border px-3 text-[12px] font-medium transition-colors hover:bg-accent/70";

let ratingDialogOpen = false;
const listeners = new Set<() => void>();

function setRatingDialogOpen(open: boolean) {
  ratingDialogOpen = open;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function promptRatingIfDue() {
  if (await claimRatingPrompt()) setRatingDialogOpen(true);
}

function rate() {
  void chrome.tabs.create({ url: CHROME_WEB_STORE_REVIEWS_URL });
  setRatingDialogOpen(false);
}

export function RatingDialog() {
  const open = useSyncExternalStore(subscribe, () => ratingDialogOpen);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && setRatingDialogOpen(false)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Popup className="screenix-editor fixed left-1/2 top-1/2 z-50 w-[360px] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border bg-background p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-[15px] font-semibold">Enjoying Screenix?</Dialog.Title>
            <Dialog.Close className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent/70 hover:text-foreground" aria-label="Close">
              <IconX size={15} stroke={1.8} />
            </Dialog.Close>
          </div>
          <div className="flex justify-center gap-1 text-[#e8b04b]" aria-hidden>
            {Array.from({ length: 5 }, (_, index) => <IconStarFilled key={index} size={22} />)}
          </div>
          <Dialog.Description className="text-center text-[12px] leading-snug text-muted-foreground">
            You've exported a few videos now. A quick rating on the Chrome Web Store helps other people find Screenix.
          </Dialog.Description>
          <div className="flex gap-2">
            <ActionButton onClick={rate}>Rate Screenix</ActionButton>
            <Dialog.Close className={SECONDARY_BUTTON}>Not now</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
