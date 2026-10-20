import { useEffect, useState, useSyncExternalStore } from "react";
import { LICENSE_DASHBOARD_URL, LICENSE_PRICING_URL, onLicenseChanged, readLicense, refreshLicense, TERMS_URL, type License } from "@/shared/license";

export interface LicenseState {
  license: License | null;
  loading: boolean;
}

export function useLicense(): LicenseState {
  const [state, setState] = useState<LicenseState>({ license: null, loading: true });

  useEffect(() => {
    let active = true;
    const load = () => {
      void readLicense().then((license) => {
        if (active) setState({ license, loading: false });
      });
    };
    load();
    const unsubscribe = onLicenseChanged(load);
    void refreshLicense();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}

export function openLicensePricing() {
  void chrome.tabs.create({ url: LICENSE_PRICING_URL });
}

export function openLicenseDashboard() {
  void chrome.tabs.create({ url: LICENSE_DASHBOARD_URL });
}

export function openTerms() {
  void chrome.tabs.create({ url: TERMS_URL });
}

let licenseDialogOpen = false;
const dialogListeners = new Set<() => void>();

function setLicenseDialogOpen(open: boolean) {
  licenseDialogOpen = open;
  for (const listener of dialogListeners) listener();
}

export const openLicenseDialog = () => setLicenseDialogOpen(true);
export const closeLicenseDialog = () => setLicenseDialogOpen(false);

function subscribeToLicenseDialog(listener: () => void) {
  dialogListeners.add(listener);
  return () => dialogListeners.delete(listener);
}

export function useLicenseDialogOpen(): boolean {
  return useSyncExternalStore(subscribeToLicenseDialog, () => licenseDialogOpen);
}
