import { createPortal } from "react-dom";
import { ActionButton } from "./controls";
import { ProgressBar } from "./ShareStatus";

export function ProgressWindow({ target, label, progress, onCancel }: {
  target: Window;
  label: string;
  progress: number;
  onCancel: () => void;
}) {
  return createPortal(
    <div className="screenix-editor flex h-full flex-col justify-center gap-3 bg-background px-4">
      <ProgressBar label={label} progress={progress} />
      <ActionButton variant="danger" onClick={onCancel}>Cancel</ActionButton>
    </div>,
    target.document.body,
  );
}
