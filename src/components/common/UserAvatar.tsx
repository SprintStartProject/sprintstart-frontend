import Avatar from "boring-avatars";

export type UserAvatarProps = {
  profileIcon?: string | null;
  fallbackName?: string;
  seed?: string;
  size?: number;
};

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
