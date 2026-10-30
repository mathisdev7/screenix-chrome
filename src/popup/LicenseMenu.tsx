import { Menu } from "@base-ui/react/menu";
import { IconChevronDown, IconKey } from "@tabler/icons-react";
import clsx from "clsx";
import { openLicensePricing } from "@/editor/hooks/useLicense";
import type { License } from "@/shared/license";

const LICENSE_PAGE = "/editor.html?license=1";

export function LicenseMenu({ license }: { license: License | null }) {
  return (
    <Menu.Root>
      <Menu.Trigger className="popup-ghost">
        <span className={clsx("size-1.5 rounded-full", license ? "bg-[#70b38f]" : "bg-muted-foreground/60")} />
        {license ? "Licensed" : "Free"}
        <IconChevronDown size={12} stroke={2} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={6} collisionPadding={8} className="z-50">
          <Menu.Popup className="popup-menu w-[210px]">
            {license ? (
              <>
                <div className="popup-menu-label truncate">{license.email}</div>
                <Menu.LinkItem href={LICENSE_PAGE} target="_blank" className="popup-menu-item">
                  <IconKey size={13} stroke={1.8} />
                  Manage license
                </Menu.LinkItem>
              </>
            ) : (
              <>
                <Menu.Item onClick={openLicensePricing} className="popup-menu-item popup-menu-gold">
                  Remove watermark
                </Menu.Item>
                <Menu.LinkItem href={LICENSE_PAGE} target="_blank" className="popup-menu-item text-muted-foreground!">
                  <IconKey size={13} stroke={1.8} />
                  Have a license key?
                </Menu.LinkItem>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
