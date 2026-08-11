/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.7.2.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/components/PasswordWrapper.tsx" --revert
 */

import type { JSX } from "@keycloakify/login-ui/tools/JSX";
import { useIsPasswordRevealed } from "@keycloakify/login-ui/tools/useIsPasswordRevealed";
import { useKcClsx } from "@keycloakify/login-ui/useKcClsx";
import { useI18n } from "../i18n";
import { Eye, EyeOff } from "lucide-react";

export function PasswordWrapper(props: { passwordInputId: string; children: JSX.Element }) {
  const { passwordInputId, children } = props;

  const { msgStr } = useI18n();

  const { kcClsx } = useKcClsx();

  const { isPasswordRevealed, toggleIsPasswordRevealed } = useIsPasswordRevealed({
    passwordInputId,
  });

  return (
    <div className={kcClsx("kcInputGroup")}>
      {children}
      <button
        type="button"
        className={"password-visibility-btn"}
        aria-label={msgStr(isPasswordRevealed ? "hidePassword" : "showPassword")}
        aria-controls={passwordInputId}
        onClick={toggleIsPasswordRevealed}
      >
        {!isPasswordRevealed && <Eye className={"visibility-icon"} aria-hidden />}
        {isPasswordRevealed && <EyeOff className={"visibility-icon"} aria-hidden />}
      </button>
    </div>
  );
}
