import { Dialog } from "@base-ui/react/dialog";
import { IconX } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { activateLicenseKey, deactivateLicense, LICENSE_ALREADY_ACTIVE, LicenseActivationError, type License } from "@/shared/license";
import { closeLicenseDialog, openLicenseDashboard, openLicensePricing, openTerms, useLicense, useLicenseDialogOpen } from "../hooks/useLicense";
import { ActionButton } from "./controls";

type Request = { status: "idle" } | { status: "pending" } | { status: "failed"; error: string; alreadyActive?: boolean };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function LicenseDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function ManageLicense({ license }: { license: License }) {
  const [request, setRequest] = useState<Request>({ status: "idle" });

  const deactivate = async () => {
    setRequest({ status: "pending" });
    try {
      await deactivateLicense();
      setRequest({ status: "idle" });
    } catch (error) {
      setRequest({ status: "failed", error: errorMessage(error) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border bg-surface-1 p-3">
        <LicenseDetail label="Status" value="Active · no watermark" />
        {license.keyHint && <LicenseDetail label="License key" value={`SCRX-••••-${license.keyHint}`} />}
      </div>
      {request.status === "failed" && <p role="alert" className="text-[12px] text-destructive">{request.error}</p>}
      <div className="space-y-2">
        <ActionButton onClick={openLicenseDashboard}>Manage licenses</ActionButton>
        <ActionButton variant="danger" disabled={request.status === "pending"} onClick={() => void deactivate()}>
          {request.status === "pending" ? "Deactivating…" : "Deactivate in this browser"}
        </ActionButton>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Deactivating frees this key so you can use it in another browser. Exports here will have a watermark again.
      </p>
    </div>
  );
}

function ActivateLicense() {
  const [key, setKey] = useState("");
  const [request, setRequest] = useState<Request>({ status: "idle" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setRequest({ status: "pending" });
    try {
      await activateLicenseKey(key);
      setKey("");
      setRequest({ status: "idle" });
    } catch (error) {
      const alreadyActive = error instanceof LicenseActivationError && error.code === LICENSE_ALREADY_ACTIVE;
      setRequest({ status: "failed", error: errorMessage(error), alreadyActive });
    }
  };

  return (
    <form className="space-y-3" onSubmit={(event) => void submit(event)}>
      <p className="text-[12px] leading-snug text-muted-foreground">
        Free exports include a Screenix watermark. Paste a license key to remove it in this browser.
      </p>
      <input
        autoFocus
        aria-label="License key"
        placeholder="SCRX-XXXX-XXXX-XXXX-XXXX"
        value={key}
        onChange={(event) => setKey(event.target.value.toUpperCase())}
        className="sidebar-input h-10 w-full px-3 font-mono tracking-wide outline-none focus:border-ring"
      />
      {request.status === "failed" && (
        <p role="alert" className="text-[12px] text-destructive">
          {request.error}
          {request.alreadyActive && (
            <>
              {" "}
              <button type="button" onClick={openLicenseDashboard} className="font-medium text-ring underline underline-offset-2 hover:text-ring/80">
                Manage licenses
              </button>
            </>
          )}
        </p>
      )}
      <ActionButton type="submit" disabled={!key.trim() || request.status === "pending"}>
        {request.status === "pending" ? "Activating…" : "Activate"}
      </ActionButton>
      <p className="text-center text-[12px] text-muted-foreground">
        No license yet?{" "}
        <button type="button" onClick={openLicensePricing} className="font-medium text-ring hover:text-ring/80">
          Remove the watermark for <s className="font-normal text-muted-foreground">$29</s> $19
        </button>
      </p>
    </form>
  );
}

export function LicenseDialog() {
  const open = useLicenseDialogOpen();
  const { license } = useLicense();

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && closeLicenseDialog()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Popup className="screenix-editor fixed left-1/2 top-1/2 z-50 w-[400px] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border bg-background p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-[15px] font-semibold">{license ? "Your license" : "Activate your license"}</Dialog.Title>
            <Dialog.Close className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent/70 hover:text-foreground" aria-label="Close">
              <IconX size={15} stroke={1.8} />
            </Dialog.Close>
          </div>
          {license ? <ManageLicense license={license} /> : <ActivateLicense />}
          <p className="border-t pt-3 text-center text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} Screenix. All rights reserved. ·{" "}
            <button type="button" onClick={openTerms} className="hover:text-foreground">
              Terms
            </button>
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
