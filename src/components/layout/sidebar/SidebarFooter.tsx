import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
import { UserAvatar } from "../../common/UserAvatar";
import { useAuth } from "../../../context/useAuth";
import { ProjectSwitcher } from "../../../features/projects/components/ProjectSwitcher";
import { navigationShortcut } from "../../../features/shortcuts";
import { hoverSpringToken } from "../../../styles/tokens";
import { SidebarAccountFlyout } from "../SidebarAccountFlyout";

type Profile = NonNullable<ReturnType<typeof useAuth>["profile"]>;

function ProfileRow({ profile, onNavigate }: { profile: Profile; onNavigate?: () => void }) {
  // The icon-only button has no room for a chip, so its name carries the chord — in both
  // attributes, because `aria-label` wins the accessible-name computation and a `title` alone
  // would reach the mouse tooltip only.
  const settingsShortcut = navigationShortcut("/settings");
  const settingsLabel = settingsShortcut ? `Settings (${settingsShortcut})` : "Settings";

  return (
    <div className="flex items-center justify-between gap-2 py-[2px]">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-surface-muted">
          <UserAvatar
            size={32}
            profileIcon={profile.profileIcon}
            fallbackName={`${profile.firstName} ${profile.lastName}`.trim()}
            seed={profile.id}
          />
        </div>

        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-sm font-semibold text-app-text">{profile.username}</span>

          <span className="truncate text-2xs font-medium tracking-wider text-app-text-muted uppercase">
            {profile.permissionGroup.replace("_", " ")}
          </span>
        </div>
      </div>
      <motion.div
        whileHover={{ scale: 1.18 }}
        whileTap={{ scale: 0.92 }}
        transition={hoverSpringToken}
        className="shrink-0"
      >
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors ${
              isActive
                ? "bg-app-brand-soft text-app-brand"
                : "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
            }`
          }
          title={settingsLabel}
          aria-label={settingsLabel}
        >
          <Settings className="h-[18px] w-[18px]" />
        </NavLink>
      </motion.div>
    </div>
  );
}

function LogoutButton() {
  const { logout, status } = useAuth();
  const loading = status === "loading";

  return (
    <motion.button
      type="button"
      onClick={() => {
        void logout();
      }}
      disabled={loading}
      whileHover={loading ? undefined : { scale: 1.02 }}
      whileTap={loading ? undefined : { scale: 0.98 }}
      transition={hoverSpringToken}
      className="flex h-[40px] w-full items-center justify-center gap-[12px] rounded-[12px] border border-app-danger-border/40 bg-app-danger-bg/70 text-sm font-medium text-app-danger-text backdrop-blur-md transition-colors hover:border-app-danger-solid hover:bg-app-danger-solid hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      <LogOut aria-hidden="true" className="h-[16px] w-[16px]" />
      Logout
    </motion.button>
  );
}

/** The footer card, the same in the open sidebar and in the folded rail's flyout. */
function FooterCard({ onNavigate }: { onNavigate?: () => void }) {
  const { profile } = useAuth();

  return (
    <div className="space-y-[12px] rounded-[18px] border border-app-border/70 bg-app-surface/70 p-[12px] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      {profile && <ProfileRow profile={profile} onNavigate={onNavigate} />}

      <ProjectSwitcher className="w-full" />

      <LogoutButton />
    </div>
  );
}

/**
 * Floating glass card instead of a full-bleed bar. The 12px outer gutter plus 12px inner padding
 * lines its content up with the 24px inset used by the nav items above. Folded, the card slides out
 * from the avatar instead of being squeezed into the rail.
 */
export function SidebarFooter({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { profile } = useAuth();

  if (!collapsed) {
    return (
      <div className="shrink-0 px-[12px] pt-[8px] pb-[16px]">
        <FooterCard onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="flex shrink-0 justify-center pt-[8px] pb-[16px]">
      <SidebarAccountFlyout
        label="Account and project"
        trigger={
          profile ? (
            <UserAvatar
              size={32}
              profileIcon={profile.profileIcon}
              fallbackName={`${profile.firstName} ${profile.lastName}`.trim()}
              seed={profile.id}
            />
          ) : (
            <Settings aria-hidden="true" className="h-[18px] w-[18px] text-app-text-muted" />
          )
        }
      >
        <FooterCard onNavigate={onNavigate} />
      </SidebarAccountFlyout>
    </div>
  );
}
