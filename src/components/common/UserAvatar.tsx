import Avatar from "boring-avatars";

export type UserAvatarProps = {
  profileIcon?: string | null;
  fallbackName?: string;
  seed?: string;
  size?: number;
};

/**
 * A user's generated avatar (boring-avatars, `beam` variant).
 *
 * The picture is derived from a seed: the user's chosen `profileIcon`, else `seed`, else
 * `fallbackName`. The same seed always gives the same face. `fallbackName` is also the
 * accessible name.
 *
 * The palette is hex values rather than tokens on purpose: boring-avatars computes the
 * contrasting face colour from the hex value itself, which a CSS variable cannot give it.
 */
export function UserAvatar({ profileIcon, fallbackName, seed, size = 40 }: UserAvatarProps) {
  const avatarSeed = profileIcon || seed || fallbackName || "User";
  const ariaName = fallbackName || "User";

  return (
    <span role="img" aria-label={`Avatar for ${ariaName}`} className="inline-block flex-shrink-0">
      <span aria-hidden="true" className="inline-flex items-center justify-center">
        <Avatar
          size={size}
          name={avatarSeed}
          variant="beam"
          colors={["#2563eb", "#00beff", "#323232", "#fde68a", "#3b82f6"]}
        />
      </span>
    </span>
  );
}
