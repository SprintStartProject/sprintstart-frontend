/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.7.2.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/styleLevelCustomization.tsx" --revert
 */

import type { ReactNode } from "react";
import type { ClassKey } from "@keycloakify/login-ui/useKcClsx";
// Order matters: `index.css` first so `login.css`'s rules win any tie on an
// identical selector (both declare `html, body` — see the overscroll-behavior
// override in login.css for why that has to hold).
import "../../styles/index.css";
import "./login.css";

type Classes = { [key in ClassKey]?: string };

type StyleLevelCustomization = {
  doUseDefaultCss: boolean;
  classes?: Classes;
  loadCustomStylesheet?: () => void;
  Provider?: (props: { children: ReactNode }) => ReactNode;
};

export function useStyleLevelCustomization(): StyleLevelCustomization {
  return {
    doUseDefaultCss: true,
  };
}
