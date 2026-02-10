import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { SectionVisualConfig } from "./visual-config";

interface Props {
  config: SectionVisualConfig;
  newsTitle?: string;
}

export const SectionLabel: React.FC<Props> = ({ config, newsTitle }) => {
  const frame = useCurrentFrame();

  // フェードイン
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const translateX = interpolate(frame, [0, 15], [-20, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 32,
        left: 40,
        opacity,
        transform: `translateX(${translateX}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* セクションバッジ */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: `${config.accentColor}22`,
          border: `1px solid ${config.accentColor}66`,
          borderRadius: 6,
          padding: "6px 14px",
          width: "fit-content",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: config.accentColor,
          }}
        />
        <span
          style={{
            color: config.accentColor,
            fontSize: 20,
            fontFamily: "'Noto Sans JP', sans-serif",
            fontWeight: 600,
          }}
        >
          {config.label}
        </span>
      </div>

      {/* ニュースタイトル */}
      {newsTitle && (
        <div
          style={{
            color: "#ffffff",
            fontSize: 28,
            fontFamily: "'Noto Sans JP', sans-serif",
            fontWeight: 700,
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          {newsTitle}
        </div>
      )}
    </div>
  );
};
