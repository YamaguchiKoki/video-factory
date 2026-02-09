/**
 * ConceptExplanationComponent
 * Displays concept explanations with different visualization templates
 */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ConceptExplanationData } from "../core/script-types";

interface ConceptExplanationComponentProps {
  data: ConceptExplanationData;
}

export const ConceptExplanationComponent: React.FC<
  ConceptExplanationComponentProps
> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance animation
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
        {data.title}
      </h2>

      {/* Template-specific rendering */}
      {data.template === "bullet-points" && (
        <BulletPointsTemplate data={data} />
      )}
      {data.template === "flowchart" && <FlowchartTemplate data={data} />}
      {data.template === "timeline" && <TimelineTemplate data={data} />}
    </div>
  );
};

// Bullet Points Template
const BulletPointsTemplate: React.FC<{ data: ConceptExplanationData }> = ({
  data,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {data.bulletPoints?.map((point, index) => {
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

        // Emphasis styling
        const emphasisStyles = {
          high: { color: "#dc2626", fontSize: "24px", fontWeight: "700" },
          medium: { color: "#1e293b", fontSize: "22px", fontWeight: "600" },
          low: { color: "#475569", fontSize: "20px", fontWeight: "500" },
        };
        const style =
          emphasisStyles[point.emphasis || "medium"] || emphasisStyles.medium;

        return (
          <div
            key={`bullet-${index}`}
            style={{
              opacity: pointOpacity,
              transform: `translateX(${pointTranslateX}px)`,
              display: "flex",
              alignItems: "flex-start",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor:
                  point.emphasis === "high" ? "#dc2626" : "#3b82f6",
                marginTop: "8px",
                flexShrink: 0,
              }}
            />
            <p
              style={{
                ...style,
                lineHeight: "1.6",
              }}
            >
              {point.text}
            </p>
          </div>
        );
      })}
    </div>
  );
};

// Flowchart Template
const FlowchartTemplate: React.FC<{ data: ConceptExplanationData }> = ({
  data,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        alignItems: "center",
      }}
    >
      {data.flowchartNodes?.map((node, index) => {
        const delayFrames = (index + 1) * 0.3 * fps;
        const nodeProgress = spring({
          frame: frame - delayFrames,
          fps,
          config: { damping: 200 },
        });

        const nodeOpacity = interpolate(nodeProgress, [0, 1], [0, 1], {
          extrapolateRight: "clamp",
        });
        const nodeScale = interpolate(nodeProgress, [0, 1], [0.8, 1], {
          extrapolateRight: "clamp",
        });

        return (
          <div key={`node-${node.id}`} style={{ textAlign: "center" }}>
            <div
              style={{
                opacity: nodeOpacity,
                transform: `scale(${nodeScale})`,
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                padding: "20px 40px",
                borderRadius: "12px",
                fontSize: "20px",
                fontWeight: "600",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                minWidth: "200px",
              }}
            >
              {node.label}
            </div>
            {node.connections.length > 0 && (
              <div
                style={{
                  width: "2px",
                  height: "32px",
                  backgroundColor: "#94a3b8",
                  margin: "0 auto",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// Timeline Template
const TimelineTemplate: React.FC<{ data: ConceptExplanationData }> = ({
  data,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "32px",
        position: "relative",
      }}
    >
      {/* Timeline line */}
      <div
        style={{
          position: "absolute",
          left: "40px",
          top: 0,
          bottom: 0,
          width: "3px",
          backgroundColor: "#cbd5e1",
        }}
      />

      {data.timelineEvents?.map((event, index) => {
        const delayFrames = (index + 1) * 0.25 * fps;
        const eventProgress = spring({
          frame: frame - delayFrames,
          fps,
          config: { damping: 200 },
        });

        const eventOpacity = interpolate(eventProgress, [0, 1], [0, 1], {
          extrapolateRight: "clamp",
        });
        const eventTranslateX = interpolate(eventProgress, [0, 1], [-30, 0], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={`event-${index}`}
            style={{
              opacity: eventOpacity,
              transform: `translateX(${eventTranslateX}px)`,
              display: "flex",
              gap: "24px",
              alignItems: "flex-start",
              position: "relative",
            }}
          >
            {/* Timeline dot */}
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                backgroundColor: "#3b82f6",
                border: "4px solid #ffffff",
                boxShadow: "0 2px 8px rgba(59, 130, 246, 0.4)",
                marginLeft: "31px",
                marginTop: "4px",
                flexShrink: 0,
                zIndex: 1,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#3b82f6",
                  marginBottom: "4px",
                }}
              >
                {event.date}
              </div>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: "700",
                  color: "#1e293b",
                  marginBottom: "8px",
                }}
              >
                {event.label}
              </div>
              {event.description && (
                <div
                  style={{
                    fontSize: "18px",
                    color: "#64748b",
                    lineHeight: "1.6",
                  }}
                >
                  {event.description}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
