import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

function base(size: number, color: string, strokeWidth: number, children: ReactNode) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export function IconCheck({ size = 20, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return base(size, color, strokeWidth, <Path d="M5 12.5l4.5 4.5L19 7" />);
}

export function IconChecklist({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Path d="M4 6h11M4 12h11M4 18h11" />
      <Path d="M19 5.5l1 1 2-2" />
      <Path d="M19 11.5l1 1 2-2" />
      <Path d="M19 17.5l1 1 2-2" />
    </>
  );
}

export function IconPackage({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <Path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
    </>
  );
}

export function IconGift({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Path d="M4 9h16v4H4z" />
      <Path d="M5 13v7h14v-7" />
      <Path d="M12 9v11" />
      <Path d="M12 9C12 6 10 4 8 4S5.5 6.5 7.5 8 12 9 12 9zM12 9c0-3 2-5 4-5s2.5 2.5 .5 4-4 1-4.5 1z" />
    </>
  );
}

export function IconPiggyBank({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Path d="M4 13c0-3 2.5-5.5 6-5.5h3c2.5 0 4.5 1.8 4.5 4 0 1.8-1.2 3.2-3 3.8" />
      <Path d="M4 13c0 3 2.5 5.5 6 5.5h2" />
      <Path d="M13 17.5V21M9 21h6" />
      <Path d="M17.5 11.5h2.5l-1.2 2.2" />
      <Circle cx="9.5" cy="12" r=".6" />
    </>
  );
}

export function IconNote({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Path d="M6 4h9l3 3v13H6z" />
      <Path d="M15 4v3h3" />
      <Path d="M9 11h6M9 15h6" />
    </>
  );
}

export function IconClock({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Circle cx="12" cy="12" r="8" />
      <Path d="M12 8v4l3 2" />
    </>
  );
}

export function IconSearch({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Circle cx="11" cy="11" r="6.5" />
      <Path d="M16 16l4 4" />
    </>
  );
}

export function IconMic({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Rect x="9" y="3" width="6" height="11" rx="3" />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  );
}

export function IconPlus({ size = 20, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return base(size, color, strokeWidth, <Path d="M12 5v14M5 12h14" />);
}

export function IconChevronRight({ size = 20, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return base(size, color, strokeWidth, <Path d="M9 6l6 6-6 6" />);
}

export function IconMoreHorizontal({ size = 20, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Circle cx="5" cy="12" r="1.4" />
      <Circle cx="12" cy="12" r="1.4" />
      <Circle cx="19" cy="12" r="1.4" />
    </>
  );
}

export function IconUtensils({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Path d="M7 3v8M4 3v4a3 3 0 0 0 6 0V3M7 11v10" />
      <Path d="M17 3c-2 0-3 2-3 5s1 4 3 4 3-1 3-4-1-5-3-5zM17 12v9" />
    </>
  );
}

export function IconCalendar({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Rect x="4" y="5" width="16" height="16" rx="2" />
      <Path d="M4 9h16M8 3v4M16 3v4" />
    </>
  );
}

export function IconChevronDown({ size = 20, color = "currentColor", strokeWidth = 2, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

export function IconGripVertical({ size = 20, color = "currentColor", strokeWidth = 2, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <Path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" />
    </Svg>
  );
}

export function IconEye({ size = 20, color = "currentColor", strokeWidth = 1.8, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconEyeOff({ size = 20, color = "currentColor", strokeWidth = 1.8, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <Path d="M3 3l18 18" />
      <Path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.3 4.1" />
      <Path d="M6.2 6.2A17 17 0 0 0 2 12s3.5 7 10 7a10.6 10.6 0 0 0 4.3-.9" />
      <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Svg>
  );
}

export function IconCalendarDays({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Rect x="4" y="5" width="16" height="16" rx="2" />
      <Path d="M4 9h16M8 3v4M16 3v4" />
      <Path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01" />
    </>
  );
}

export function IconWalletCards({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Path d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H3z" />
      <Rect x="3" y="9" width="18" height="11" rx="2" />
      <Path d="M16 14.5h3" />
    </>
  );
}

export function IconBookOpenCheck({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Path d="M12 6S9 4 5 4v14c4 0 7-2 7-2c0 0 3 2 7 2V4c-4 0-7 2-7 2z" />
      <Path d="M9 9l2 2 3-3" />
    </>
  );
}

export function IconDumbbell({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Path d="M5 9v6M19 9v6" />
      <Path d="M5 12h14" />
      <Path d="M3 7v10M21 7v10" />
      <Path d="M7 8v8M17 8v8" />
    </>
  );
}

export function IconClapperboard({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Rect x="3" y="7" width="18" height="12" rx="2" />
      <Path d="M3 7l2.5-3 2.5 3M10 7l2.5-3 2.5 3M17 7l2.5-3 2.5 3" />
    </>
  );
}

export function IconHeart({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(size, color, strokeWidth, <Path d="M12 21C12 21 4 14.5 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5.5-8 12-8 12z" />);
}

export function IconSettings({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Circle cx="12" cy="12" r="3.2" />
      <Path d="M19.4 13.5a7.9 7.9 0 0 0 0-3l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A8 8 0 0 0 7 6.5l-2.4-1-2 3.5 2 1.5a7.9 7.9 0 0 0 0 3l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a8 8 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5Z" />
    </>
  );
}

export function IconUser({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Circle cx="12" cy="8" r="3.6" />
      <Path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </>
  );
}

export function IconPalette({ size = 20, color = "currentColor", strokeWidth = 1.8 }: IconProps) {
  return base(
    size,
    color,
    strokeWidth,
    <>
      <Path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2.2-.9 2.2-1.9 0-1.3-1-1.7-1-2.7 0-.8.7-1.4 1.6-1.4h1.4A4.3 4.3 0 0 0 20.5 10c0-3.6-3.6-6.5-8.5-6.5Z" />
      <Circle cx="8" cy="10" fill={color} r="1.1" stroke="none" />
      <Circle cx="12" cy="7.6" fill={color} r="1.1" stroke="none" />
      <Circle cx="15.8" cy="10" fill={color} r="1.1" stroke="none" />
    </>
  );
}
