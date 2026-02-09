/**
 * ConversationSummaryComponent
 * Displays conversation summary with key points and importance-based highlighting
 */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ConversationSummaryData } from "../core/script-types";

interface ConversationSummaryComponentProps {
  data: ConversationSummaryData;
}

export const ConversationSummaryComponent: React.FC<
  ConversationSummaryComponentProps
> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance animation for the entire component
  const entranceProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  const opacity = interpolate(entranceProgress, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(entranceProgress, [0, 1], [30, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        padding: "48px",
        maxWidth: "1000px",
        margin: "0 auto",
      }}
    >
      {/* Title */}
      <h2
        style={{
          fontSize: "36px",
          fontWeight: "700",
          color: "#1e293b",
          marginBottom: "32px",
          textAlign: "center",
          borderBottom: "3px solid #3b82f6",
          paddingBottom: "16px",
        }}
      >
        まとめ
      </h2>

      {/* Summary Text */}
      <div
        style={{
          fontSize: "24px",
          fontWeight: "600",
          color: "#334155",
          lineHeight: "1.8",
          marginBottom: "40px",
          padding: "24px",
          backgroundColor: "#f8fafc",
          borderRadius: "12px",
          borderLeft: "4px solid #3b82f6",
        }}
      >
        {data.summaryText}
      </div>

      {/* Key Points */}
      {data.keyPoints.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <h3
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "#475569",
              marginBottom: "8px",
            }}
          >
            ポイント
          </h3>
          {data.keyPoints.map((point, index) => {
            // Sequential animation for each key point
            const delayFrames = (index + 1) * 0.2 * fps;
            const pointProgress = spring({
              frame: frame - delayFrames,
              fps,
              config: { damping: 200 },
            });

            const pointOpacity = interpolate(pointProgress, [0, 1], [0, 1], {
              extrapolateRight: "clamp",
            });
            const pointTranslateX = interpolate(pointProgress, [0, 1], [-20, 0], {
              extrapolateRight: "clamp",
            });

            // Importance-based styling
            const importanceStyles = {
              high: {
                color: "#dc2626",
                fontSize: "22px",
                fontWeight: "700",
                backgroundColor: "#fef2f2",
                borderColor: "#dc2626",
                iconColor: "#dc2626",
              },
              medium: {
                color: "#1e293b",
                fontSize: "20px",
                fontWeight: "600",
                backgroundColor: "#ffffff",
                borderColor: "#3b82f6",
                iconColor: "#3b82f6",
              },
              low: {
                color: "#64748b",
                fontSize: "18px",
                fontWeight: "500",
                backgroundColor: "#f8fafc",
                borderColor: "#94a3b8",
                iconColor: "#94a3b8",
              },
            };

            const style = importanceStyles[point.importance];

            return (
              <div
                key={`key-point-${index}`}
                style={{
                  opacity: pointOpacity,
                  transform: `translateX(${pointTranslateX}px)`,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "16px",
                  padding: "20px",
                  backgroundColor: style.backgroundColor,
                  borderRadius: "12px",
                  border: `2px solid ${style.borderColor}`,
                }}
              >
                {/* Importance indicator icon */}
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    backgroundColor: style.iconColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: "700",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {point.importance === "high"
                    ? "!"
                    : point.importance === "medium"
                      ? "●"
                      : "◦"}
                </div>

                {/* Key point text */}
                <p
                  style={{
                    color: style.color,
                    fontSize: style.fontSize,
                    fontWeight: style.fontWeight,
                    lineHeight: "1.6",
                  }}
                >
                  {point.text}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
