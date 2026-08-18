import { useCallback, useState } from "react";
import { ChartColumn, Check, LayoutGrid, Plus, RotateCcw } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { AlertDialog } from "../components/ui/AlertDialog";
import { Button } from "../components/ui/Button";
import { Game2048Modal } from "../features/game2048/components/Game2048Modal";
import { useGame2048Shortcut } from "../features/game2048/hooks/useGame2048Shortcut";
import { DinoGameModal } from "../features/dino/components/DinoGameModal";
import { useDinoShortcut } from "../features/dino/hooks/useDinoShortcut";
import { SpaceInvadersModal } from "../features/space-invaders/components/SpaceInvadersModal";
import { useSpaceInvadersShortcut } from "../features/space-invaders/hooks/useSpaceInvadersShortcut";
import { AddWidgetModal } from "../features/dashboard/components/AddWidgetModal";
import { DashboardGrid } from "../features/dashboard/components/DashboardGrid";
import { useDashboardLayout } from "../features/dashboard/layout/useDashboardLayout";

/**
 * Central hub displayed after login — and, since the dashboard became configurable, little
 * more than a frame around one.
 *
 * The page owns three things: whether the board is being edited, the two dialogs that only
 * exist in that mode, and the easter-egg shortcuts that have always lived here. Everything
 * about *what* is on the dashboard belongs to {@link useDashboardLayout}, and everything
 * about how it is arranged to `DashboardGrid` — so adding a widget never means touching this
 * file.
 *
 * A user who has never edited anything sees exactly the dashboard they saw before: the
 * default layout is the old page, in the old order, with the same role-dependent slot.
 */
export function DashboardPage() {
  const controller = useDashboardLayout();

  const [isEditing, setIsEditing] = useState(false);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [isResetOpen, setResetOpen] = useState(false);

  // 2048 easter egg: Ctrl+Shift+2 opens the game in a modal.
  const [game2048Open, setGame2048Open] = useState(false);
  const openGame2048 = useCallback(() => setGame2048Open(true), []);
  useGame2048Shortcut(openGame2048);

  // Dino easter egg: Ctrl+Shift+1 opens the runner in a modal.
  // Bypasses the `dinoUnlocked` gate that the sidebar/chat use — the
  // dashboard chord is a true easter egg, always available.
  const [dinoOpen, setDinoOpen] = useState(false);
  const openDino = useCallback(() => setDinoOpen(true), []);
  useDinoShortcut(openDino);

  // Space Invaders easter egg: Ctrl+Shift+3 opens the game in a modal.
  const [invadersOpen, setInvadersOpen] = useState(false);
  const openInvaders = useCallback(() => setInvadersOpen(true), []);
  useSpaceInvadersShortcut(openInvaders);

  return (
    <div className="min-h-screen">
      <header className="border-b border-app-border bg-app-bg">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={ChartColumn}
            title="Dashboard"
            subtitle={
              isEditing
                ? "Drag a widget to move it, change its size, or add another one."
                : "Your central workspace — arrange it however you work."
            }
            actions={
              isEditing ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setPickerOpen(true)}
                    disabled={controller.addableWidgets.length === 0}
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Add widget
                  </Button>

                  {controller.isCustomized && (
                    <Button
                      variant="ghost"
                      onClick={() => setResetOpen(true)}
                      icon={<RotateCcw className="h-4 w-4" />}
                    >
                      Reset
                    </Button>
                  )}

                  <Button
                    variant="primary"
                    onClick={() => setIsEditing(false)}
                    icon={<Check className="h-4 w-4" />}
                  >
                    Done
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setIsEditing(true)}
                  icon={<LayoutGrid className="h-4 w-4" />}
                >
                  Edit dashboard
                </Button>
              )
            }
          />
        </div>
      </header>

      <main className="app-page-frame py-6 pb-24 lg:py-8">
        <DashboardGrid controller={controller} isEditing={isEditing} />
      </main>

      <AddWidgetModal
        isOpen={isPickerOpen}
        widgets={controller.addableWidgets}
        onAdd={controller.addWidget}
        onClose={() => setPickerOpen(false)}
      />

      <AlertDialog
        isOpen={isResetOpen}
        title="Reset your dashboard?"
        description="Your arrangement is replaced by the default layout for your role. The widgets themselves are not affected."
        confirmLabel="Reset"
        variant="danger"
        onConfirm={() => {
          controller.resetLayout();
          setResetOpen(false);
        }}
        onClose={() => setResetOpen(false)}
      />

      <Game2048Modal open={game2048Open} onClose={() => setGame2048Open(false)} />
      <DinoGameModal open={dinoOpen} onClose={() => setDinoOpen(false)} />
      <SpaceInvadersModal open={invadersOpen} onClose={() => setInvadersOpen(false)} />
    </div>
  );
}
