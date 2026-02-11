import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { IntroSectionMarker } from "../../schema/schema";
import { SectionVisualConfig } from "../visual-config";

interface IntroContentProps {
  marker: IntroSectionMarker;
  config: SectionVisualConfig;
}

export const IntroContent: React.FC<IntroContentProps> = ({
  marker,
  config,
}) => {
  const frame = useCurrentFrame();

  // If no agenda data, render nothing (label will be shown separately)
  const agenda = marker.agenda;
  if (!agenda || agenda.length === 0) {
    return null;
  }

  // Fade-in animation
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 20], [0.95, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 1200,
        width: "80%",
      }}
    >
      {/* Agenda Title */}
      <h2
        style={{
          color: "#ffffff",
          fontSize: 56,
          fontFamily: "'Noto Sans JP', sans-serif",
          fontWeight: 700,
          margin: 0,
          textAlign: "center",
        }}
      >
        今日のトピック
      </h2>

      {/* Agenda List */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {agenda.map((item, index) => (
          <AgendaItem
            key={item.id}
            item={item}
            index={index}
            accentColor={config.accentColor}
          />
        ))}
      </div>
    </div>
  );
};

interface AgendaItemProps {
  item: { id: string; title: string };
  index: number;
  accentColor: string;
}

const AgendaItem: React.FC<AgendaItemProps> = ({
  item,
  index,
  accentColor,
}) => {
  const frame = useCurrentFrame();

  // Staggered animation: each item appears 0.3s after previous
  // At 30fps: 0.3s = 9 frames
  const delay = 20 + index * 9; // 20 frame base delay + stagger
  const itemOpacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const itemTranslateY = interpolate(frame, [delay, delay + 15], [20, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        opacity: itemOpacity,
        transform: `translateY(${itemTranslateY}px)`,
        backgroundColor: `${accentColor}11`, // 7% opacity background
        padding: "24px 32px",
        borderRadius: 12,
        border: `2px solid ${accentColor}44`, // 27% opacity border
      }}
    >
      {/* Number Badge */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: `${accentColor}33`, // 20% opacity
          border: `3px solid ${accentColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: accentColor,
            fontSize: 28,
            fontFamily: "'Noto Sans JP', sans-serif",
            fontWeight: 700,
          }}
        >
          {index + 1}
        </span>
      </div>

      {/* Title */}
      <span
        style={{
          color: "#ffffff",
          fontSize: 36,
          fontFamily: "'Noto Sans JP', sans-serif",
          fontWeight: 600,
          lineHeight: 1.5,
        }}
      >
        {item.title}
      </span>
    </div>
  );
};

