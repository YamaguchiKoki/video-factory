import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TimedLine } from "../schema/schema";
import { SectionVisualConfig } from "./visual-config";

interface Props {
  line: TimedLine;
  config: SectionVisualConfig;
}

const SPEAKER_NAMES: Record<string, string> = {
  A: "ずんだもん",
  B: "四国めたん",
};

export const Subtitle: React.FC<Props> = ({ line, config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 出現アニメーション
  const appear = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 120 },
  });
  const translateY = interpolate(appear, [0, 1], [20, 0]);
  const opacity = interpolate(appear, [0, 1], [0, 1]);

  const nameColor =
    line.speaker === "A" ? config.speakerAColor : config.speakerBColor;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 60,
        right: 60,
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* 話者名 */}
      <span
        style={{
          color: nameColor,
          fontSize: 22,
          fontFamily: "'Noto Sans JP', sans-serif",
          fontWeight: 700,
        }}
      >
        {SPEAKER_NAMES[line.speaker] ?? line.speaker}
      </span>

      {/* セリフ */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.65)",
          backdropFilter: "blur(8px)",
          borderRadius: 12,
          padding: "16px 28px",
          borderLeft: `4px solid ${nameColor}`,
        }}
      >
        <span
          style={{
            color: "#f0f0f0",
            fontSize: 32,
            fontFamily: "'Noto Sans JP', sans-serif",
            fontWeight: 500,
            lineHeight: 1.6,
          }}
        >
          {line.text}
        </span>
      </div>
    </div>
  );
};
