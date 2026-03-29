/**
 * AvatarComponent
 * アクティブ状態に基づいたアニメーション付きで話者アバターを表示
 */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Speaker } from "../core/script-types";

interface AvatarComponentProps {
  speaker: Speaker;
  isActive: boolean;
}

// ロールに基づくアバターカラー
const AVATAR_COLORS = {
  agent: {
    bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    initial: "🤖",
  },
  questioner: {
    bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    initial: "👤",
  },
} as const;

const getAvatarBorder = (isActive: boolean): string => {
  return isActive ? "4px solid #3b82f6" : "4px solid #ffffff";
};

const getAvatarBoxShadow = (isActive: boolean): string => {
  return isActive
    ? "0 4px 20px rgba(59, 130, 246, 0.6)"
    : "0 2px 12px rgba(0, 0, 0, 0.15)";
};

export const AvatarComponent: React.FC<AvatarComponentProps> = ({
  speaker,
  isActive,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // アクティブ状態遷移用のスプリングアニメーション
  const activeProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  // スケール: アクティブ時1.1倍、非アクティブ時1.0倍
  const scale = isActive
    ? interpolate(activeProgress, [0, 1], [1.0, 1.1])
    : interpolate(activeProgress, [0, 1], [1.1, 1.0]);

  // 垂直移動: アクティブ時に軽いボブエフェクト（2-3px）
  const bobCycle = fps * 2;
  const bobAnimation = spring({
    frame: frame % bobCycle,
    fps,
    config: { damping: 10, stiffness: 50 },
  });
  const translateY = isActive ? interpolate(bobAnimation, [0, 1], [0, -3]) : 0;

  // 不透明度: 非アクティブ時80%、アクティブ時100%
  const opacity = isActive ? 1.0 : 0.8;

  const avatarStyle = AVATAR_COLORS[speaker.role];
  const border = getAvatarBorder(isActive);
  const boxShadow = getAvatarBoxShadow(isActive);

  return (
    <div
      data-testid="avatar-container"
      className="flex flex-col items-center gap-2"
      style={{
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity,
      }}
    >
      <div
        className="w-[120px] h-[120px] rounded-full flex items-center justify-center text-5xl"
        style={{
          background: avatarStyle.bg,
          border,
          boxShadow,
        }}
      >
        {avatarStyle.initial}
      </div>
      <div
        className={`text-lg text-center ${isActive ? "font-bold text-blue-800" : "font-medium text-slate-500"}`}
      >
        {speaker.name}
      </div>
    </div>
  );
};
