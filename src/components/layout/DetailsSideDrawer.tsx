import type { ReactNode } from "react";
import { SidePanel } from "../ui/SidePanel";

type DetailsSideDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  leading: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
  zIndexClassName?: string;
  showOverlay?: boolean;
  overlayClassName?: string;
  contentClassName?: string;
  headerClassName?: string;
  closeAriaLabel?: string;
};

export function DetailsSideDrawer({
  isOpen,
  onClose,
  title,
  leading,
  badge,
  actions,
  children,
  footer,
  widthClassName = "w-full sm:w-[min(94vw,34rem)] lg:w-[min(72vw,58rem)]",
  zIndexClassName = "z-40",
  showOverlay = false,
  overlayClassName = "bg-app-overlay",
  contentClassName = "mx-3 px-3 pb-8 pt-4 sm:mx-5 sm:px-4 sm:pb-10 sm:pt-5 lg:px-5 lg:pt-6",
  headerClassName = "mx-3 px-3 pb-4 pt-4 sm:mx-5 sm:px-4 sm:pb-5 sm:pt-5 lg:px-5 lg:pt-6",
  closeAriaLabel = "Close details",
}: DetailsSideDrawerProps) {
  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      leading={leading}
      badge={badge}
      actions={actions}
      footer={footer}
      widthClassName={widthClassName}
      zIndexClassName={zIndexClassName}
      showOverlay={showOverlay}
      overlayClassName={overlayClassName}
      contentClassName={contentClassName}
      headerClassName={headerClassName}
      closeAriaLabel={closeAriaLabel}
    >
      {children}
    </SidePanel>
  );
}
