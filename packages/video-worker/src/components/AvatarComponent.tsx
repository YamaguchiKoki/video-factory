/**
 * AvatarComponent
 * Displays speaker avatar with animations based on active state
 */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Speaker } from "../core/script-types";

interface AvatarComponentProps {
  speaker: Speaker;
  isActive: boolean;
}

export const AvatarComponent: React.FC<AvatarComponentProps> = ({
  speaker,
  isActive,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring animation for active state transition
  const activeProgress = spring({
    frame,
    fps,
    config: { damping: 200 }, // Smooth, no bounce
  });

  // Scale: 1.1x when active, 1.0x when inactive
  const scale = isActive
    ? interpolate(activeProgress, [0, 1], [1.0, 1.1])
    : interpolate(activeProgress, [0, 1], [1.1, 1.0]);

  // Vertical movement: slight bob effect when active (2-3px)
  const bobAnimation = spring({
    frame: frame % (fps * 2), // 2 second cycle
    fps,
    config: { damping: 10, stiffness: 50 },
  });
  const translateY = isActive
    ? interpolate(bobAnimation, [0, 1], [0, -3])
    : 0;

  // Opacity: 80% when inactive, 100% when active
  const opacity = isActive ? 1.0 : 0.8;

  // Avatar colors based on role
  const avatarColors = {
    agent: {
      bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      initial: "🤖",
    },
    questioner: {
      bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      initial: "👤",
    },
  };

  const avatarStyle = avatarColors[speaker.role];

  return (
    <div
      data-testid="avatar-container"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        transform: `scale(${scale}) translateY(${translateY}px)`,
        opacity,
      }}
    >
      <div
        style={{
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          background: avatarStyle.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "48px",
          border: isActive ? "4px solid #3b82f6" : "4px solid #ffffff",
          boxShadow: isActive
            ? "0 4px 20px rgba(59, 130, 246, 0.6)"
            : "0 2px 12px rgba(0, 0, 0, 0.15)",
        }}
      >
        {avatarStyle.initial}
      </div>
      <div
        style={{
          fontSize: "18px",
          fontWeight: isActive ? "700" : "500",
          color: isActive ? "#1e40af" : "#64748b",
          textAlign: "center",
        }}
      >
        {speaker.name}
      </div>
    </div>
  );
};
