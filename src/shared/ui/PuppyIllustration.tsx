import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

export type PuppyScene = "generic" | "checklist" | "package" | "piggy" | "gift" | "search";

type Props = {
  /** 场景：决定小狗旁边伴随的线稿图标（空状态语义）。 */
  scene?: PuppyScene;
  /** 线条颜色，默认柔绿。 */
  color?: string;
  size?: number;
};

/**
 * 统一的小狗线稿插画：单色、简洁、绿/灰绿色，不占据大面积。
 * 仅用于空状态 / 全部完成 / 小里程碑等状态反馈，不进入任何业务布局。
 * 同屏最多出现一个（由调用方控制）。
 */
export function PuppyIllustration({ scene = "generic", color = "#9cc39c", size = 92 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" accessibilityLabel="小狗插画">
      {/* 身体（坐姿） */}
      <Path d="M34 96c-6-22 0-40 22-40s26 14 24 32c-1 8-2 22-2 22" />
      <Path d="M86 110V96c0-10-4-18-12-22" />
      {/* 前腿 */}
      <Path d="M48 96v14M64 96v14" />
      {/* 头 */}
      <Path d="M40 56c-8-6-10-20-2-26 4-3 10-3 14 0 6-7 16-6 20 1 6 6 4 18-3 24" />
      {/* 耳朵（ floppy） */}
      <Path d="M40 34c-6-10-4-18 3-18 2 6 1 12-1 17" />
      <Path d="M68 32c5-9 14-9 16-2-3 5-9 7-13 5" />
      {/* 口鼻 */}
      <Path d="M62 54c8 1 12 4 12 8" />
      <Path d="M62 60c-1 5-4 7-8 6" />
      {/* 眼睛 */}
      <Circle cx="50" cy="52" r="1.8" fill={color} stroke="none" />
      <Circle cx="62" cy="51" r="1.8" fill={color} stroke="none" />
      {/* 鼻子 */}
      <Circle cx="58" cy="58" r="1.6" fill={color} stroke="none" />
      {/* 尾巴 */}
      <Path d="M34 96c-8 0-12-6-10-14" />

      {scene === "checklist" ? (
        <g transform="translate(74 58)">
          <Rect x="0" y="0" width="34" height="40" rx="5" />
          <Path d="M7 12h20M7 21h20M7 30h14" />
          <Path d="M27 7l2 2 4-4" />
        </g>
      ) : null}

      {scene === "package" ? (
        <g transform="translate(76 56)">
          <Path d="M2 10L17 3l15 7v18L17 37 2 28z" />
          <Path d="M2 10L17 17l15-7M17 17v20" />
        </g>
      ) : null}

      {scene === "piggy" ? (
        <g transform="translate(74 54)">
          <Path d="M4 22c0-10 7-16 16-16h4c6 0 10 5 10 11 0 5-3 9-8 11" />
          <Path d="M4 22c0 9 7 16 16 16h4" />
          <Path d="M38 19h6l-3 5" />
          <Circle cx="14" cy="20" r="1.6" fill={color} stroke="none" />
        </g>
      ) : null}

      {scene === "gift" ? (
        <g transform="translate(74 54)">
          <Rect x="2" y="12" width="36" height="22" rx="3" />
          <Path d="M4 18v16M36 18v16M20 12v22M20 12c-3-6-10-4-8 1 1 2 5 3 8 1M20 12c3-6 10-4 8 1-1 2-5 3-8 1" />
        </g>
      ) : null}

      {scene === "search" ? (
        <g transform="translate(76 56)">
          <Circle cx="12" cy="12" r="9" />
          <Path d="M19 19l7 7" />
        </g>
      ) : null}
    </Svg>
  );
}
