import { getInitials } from "../utils/helpers";

interface AvatarProps {
  name: string;
  colorClass: string;
  size?: "sm" | "md" | "lg";
}

const SIZE: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
};

export default function Avatar({ name, colorClass, size = "md" }: AvatarProps) {
  return (
    <div
      className={`${SIZE[size]} ${colorClass} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 select-none`}
    >
      {getInitials(name)}
    </div>
  );
}
