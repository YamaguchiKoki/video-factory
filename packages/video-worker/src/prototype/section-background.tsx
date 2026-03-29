import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { SectionVisualConfig } from "./visual-config";

interface Props {
  config: SectionVisualConfig;
}

export const SectionBackground: React.FC<Props> = ({ config }) => {
  const frame = useCurrentFrame();

  // 微妙にグラデーションをアニメーション
  const gradientAngle = interpolate(frame, [0, 300], [135, 145], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {/* ベース背景 */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(${gradientAngle}deg, ${config.backgroundColor} 0%, ${config.backgroundColor}ee 60%, ${config.accentColor}22 100%)`,
        }}
      />
      {/* アクセントライン（上部） */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: config.accentColor,
          opacity: 0.8,
        }}
      />
      {/* 角のアクセント */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          right: 40,
          width: 120,
          height: 120,
          border: `2px solid ${config.accentColor}33`,
          borderRadius: 8,
        }}
      />
    </AbsoluteFill>
  );
};
