import clsx from "clsx";
import { openLicenseDialog, openLicensePricing, useLicense } from "../hooks/useLicense";

export function LicenseStatus() {
  const { license, loading } = useLicense();
  if (loading) return null;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        title={license ? "Manage your license" : "Activate a license key"}
        onClick={openLicenseDialog}
        className="flex h-7 max-w-[260px] items-center gap-2 rounded-lg border px-3 text-xs transition-colors hover:bg-accent/70"
      >
        <span className={clsx("size-1.5 shrink-0 rounded-full", license ? "bg-[#70b38f]" : "bg-[#d9a45a]")} />
        <span className="truncate">{license ? `Licensed · ${license.email}` : "Free · exports have a watermark"}</span>
      </button>
      {!license && (
        <button type="button" onClick={openLicensePricing} className="gold-button flex h-7 items-center rounded-lg px-3 text-xs">
          Remove watermark
        </button>
      )}
    </div>
  );
}
