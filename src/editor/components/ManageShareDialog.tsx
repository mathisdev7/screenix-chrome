import { Dialog } from "@base-ui/react/dialog";
import { IconCopy, IconExternalLink, IconLoader2, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { deleteShare, getShareDetails, updateShareDetails } from "@/share/shareVideo";
import type { ProjectShare } from "@/shared/types";
import { forgetShare } from "../lib/exportCache";
import { ActionButton } from "./controls";

type Details =
  | { status: "loading" }
  | { status: "ready"; title: string; description: string }
  | { status: "missing" }
  | { status: "error"; message: string };

type Action =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "confirmDelete" }
  | { status: "deleting" }
  | { status: "failed"; message: string };

const INPUT = "sidebar-input w-full px-3 text-[13px] outline-none focus:border-ring";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ManageShareDialog({ share, onDeleted, onClose }: {
  share: ProjectShare;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<Details>({ status: "loading" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [action, setAction] = useState<Action>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const onDeletedRef = useRef(onDeleted);

  useEffect(() => {
    let active = true;
    getShareDetails(share.id).then((loaded) => {
      if (!active) return;
      if (!loaded) {
        forgetShare(share.id);
        onDeletedRef.current();
        setDetails({ status: "missing" });
        return;
      }
      setTitle(loaded.title);
      setDescription(loaded.description ?? "");
      setDetails({ status: "ready", title: loaded.title, description: loaded.description ?? "" });
    }, (error: unknown) => {
      if (active) setDetails({ status: "error", message: errorMessage(error) });
    });
    return () => {
      active = false;
    };
  }, [share.id]);

  const changed = details.status === "ready" && (title.trim() !== details.title || description.trim() !== details.description);
  const busy = action.status === "saving" || action.status === "deleting";

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!changed || !title.trim()) return;
    setAction({ status: "saving" });
    try {
      await updateShareDetails(share.id, title.trim(), description.trim());
      setDetails({ status: "ready", title: title.trim(), description: description.trim() });
      setAction({ status: "saved" });
    } catch (error) {
      setAction({ status: "failed", message: errorMessage(error) });
    }
  };

  const remove = async () => {
    if (action.status !== "confirmDelete") {
      setAction({ status: "confirmDelete" });
      return;
    }
    setAction({ status: "deleting" });
    try {
      await deleteShare(share.id);
      forgetShare(share.id);
      onDeleted();
      onClose();
    } catch (error) {
      setAction({ status: "failed", message: errorMessage(error) });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Popup className="screenix-editor fixed left-1/2 top-1/2 z-50 w-[440px] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border bg-background p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-[15px] font-semibold">Shared video</Dialog.Title>
            <Dialog.Close className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent/70 hover:text-foreground" aria-label="Close">
              <IconX size={15} stroke={1.8} />
            </Dialog.Close>
          </div>

          {details.status === "loading" && (
            <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <IconLoader2 size={14} className="animate-spin" />
              Loading your link…
            </p>
          )}
          {details.status === "missing" && (
            <p className="text-[12px] text-muted-foreground">This link was deleted. Use Share to create a new one.</p>
          )}
          {details.status === "error" && <p className="text-[12px] text-destructive">{details.message}</p>}

          {details.status === "ready" && (
            <form className="space-y-4" onSubmit={(event) => void save(event)}>
              <div className="flex items-center gap-2 rounded-lg border bg-surface-1 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[12px] text-ring">{share.url}</span>
                <button type="button" title="Copy link" aria-label="Copy link" onClick={() => void copy()} className="text-muted-foreground hover:text-foreground">
                  <IconCopy size={14} />
                </button>
                <button
                  type="button"
                  title="Open link"
                  aria-label="Open link"
                  onClick={() => void chrome.tabs.create({ url: share.url })}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <IconExternalLink size={14} />
                </button>
              </div>
              {copied && <p className="-mt-2 text-[11px] text-muted-foreground">Link copied.</p>}

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">Title</span>
                <input
                  value={title}
                  maxLength={120}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setAction({ status: "idle" });
                  }}
                  className={`${INPUT} h-10`}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">Description</span>
                <textarea
                  value={description}
                  maxLength={2000}
                  rows={4}
                  placeholder="Add context for the people you share this with"
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setAction({ status: "idle" });
                  }}
                  className={`${INPUT} resize-none py-2`}
                />
              </label>

              {action.status === "saved" && <p className="text-[12px] text-muted-foreground">Changes saved.</p>}
              {action.status === "failed" && <p className="text-[12px] text-destructive">{action.message}</p>}

              <div className="flex gap-2">
                <ActionButton type="submit" disabled={!changed || !title.trim() || busy}>
                  {action.status === "saving" ? "Saving…" : "Save changes"}
                </ActionButton>
                <ActionButton type="button" variant="danger" disabled={busy} onClick={() => void remove()}>
                  {action.status === "deleting" ? "Deleting…" : action.status === "confirmDelete" ? "Click again to delete" : "Delete link"}
                </ActionButton>
              </div>
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
