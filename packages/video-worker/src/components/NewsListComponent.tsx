/**
 * NewsListComponent
 * Displays a list of news items with sequential animations
 */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { NewsListData } from "../core/script-types";

interface NewsListComponentProps {
  data: NewsListData;
}

export const NewsListComponent: React.FC<NewsListComponentProps> = ({
  data,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "32px",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <h2
        style={{
          fontSize: "32px",
          fontWeight: "700",
          color: "#1e293b",
          marginBottom: "16px",
          textAlign: "center",
        }}
      >
        今日のニュース
      </h2>
      {data.items.map((item, index) => {
        // Sequential animation: each item starts 0.3 seconds after the previous
        const delayFrames = index * 0.3 * fps;
        const itemProgress = spring({
          frame: frame - delayFrames,
          fps,
          config: { damping: 200 }, // Smooth, no bounce
        });

        // Fade in + slide up animation
        const opacity = interpolate(itemProgress, [0, 1], [0, 1], {
          extrapolateRight: "clamp",
        });
        const translateY = interpolate(itemProgress, [0, 1], [20, 0], {
          extrapolateRight: "clamp",
        });

        // Category color mapping
        const categoryColors: Record<string, string> = {
          政治: "#dc2626",
          経済: "#2563eb",
          テクノロジー: "#7c3aed",
          環境: "#059669",
          社会: "#f59e0b",
        };
        const categoryColor = categoryColors[item.category] || "#64748b";

        return (
          <div
            key={`news-item-${index}`}
            style={{
              opacity,
              transform: `translateY(${translateY}px)`,
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
              border: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span
                style={{
                  backgroundColor: categoryColor,
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "600",
                  padding: "4px 12px",
                  borderRadius: "16px",
                }}
              >
                {item.category}
              </span>
              <span
                style={{
                  fontSize: "14px",
                  color: "#94a3b8",
                }}
              >
                {item.date}
              </span>
            </div>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "600",
                color: "#1e293b",
                lineHeight: "1.5",
              }}
            >
              {item.title}
            </h3>
          </div>
        );
      })}
    </div>
  );
};
