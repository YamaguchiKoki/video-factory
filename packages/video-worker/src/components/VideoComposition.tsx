/**
 * VideoComposition
 * Main composition component that integrates all visual elements
 * Handles audio synchronization, segment timing, and avatar state control
 */

import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, staticFile, interpolate } from "remotion";
import { Audio } from "@remotion/media";
import type { ParsedScript, Speaker } from "../core/script-types";
import { AvatarComponent } from "./AvatarComponent";
import { NewsListComponent } from "./NewsListComponent";
import { ConceptExplanationComponent } from "./ConceptExplanationComponent";
import { ConversationSummaryComponent } from "./ConversationSummaryComponent";

interface VideoCompositionProps {
  script: ParsedScript;
  audioPath: string;
  speakers: Speaker[];
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  script,
  audioPath,
  speakers,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      {/* Background */}
      <AbsoluteFill
        style={{
          backgroundColor: "#f1f5f9",
        }}
      />

      {/* Audio Track */}
      {audioPath && <Audio src={staticFile(audioPath)} volume={1} />}

      {/* Main Content Area */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "40px",
        }}
      >
        {/* Segments Area (Center) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "160px",
          }}
        >
          {script.segments.map((segment) => {
            const startFrame = Math.floor(segment.startTime * fps);
            const endFrame = Math.floor(segment.endTime * fps);
            const durationInFrames = endFrame - startFrame;

            return (
              <Sequence
                key={segment.id}
                from={startFrame}
                durationInFrames={durationInFrames}
                premountFor={Math.floor(1 * fps)} // Premount 1 second before
              >
                <SegmentContent segment={segment} speakers={speakers} />
              </Sequence>
            );
          })}
        </div>

        {/* Avatars (Bottom) - Always visible */}
        <AvatarsLayer speakers={speakers} segments={script.segments} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * SegmentContent
 * Renders content for a single segment with fade-in animation
 */
interface SegmentContentProps {
  segment: ParsedScript["segments"][0];
  speakers: Speaker[];
}

const SegmentContent: React.FC<SegmentContentProps> = ({ segment, speakers }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in over 0.3 seconds
  const opacity = interpolate(frame, [0, 0.3 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Scale animation
  const scale = interpolate(frame, [0, 0.3 * fps], [0.95, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {segment.visualComponent ? (
        <VisualComponentRenderer visualComponent={segment.visualComponent} />
      ) : (
        <TextDisplay text={segment.text} speakerId={segment.speakerId} speakers={speakers} />
      )}
    </div>
  );
};

/**
 * TextDisplay
 * Displays segment text with speaker name
 */
interface TextDisplayProps {
  text: string;
  speakerId: string;
  speakers: Speaker[];
}

const TextDisplay: React.FC<TextDisplayProps> = ({ text, speakerId, speakers }) => {
  const speaker = speakers.find((s) => s.id === speakerId);

  return (
    <div
      style={{
        maxWidth: "1200px",
        padding: "48px",
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.1)",
      }}
    >
      {speaker && (
        <div
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#64748b",
            marginBottom: "16px",
          }}
        >
          {speaker.name}
        </div>
      )}
      <p
        style={{
          fontSize: "32px",
          fontWeight: "600",
          color: "#1e293b",
          lineHeight: "1.6",
          textAlign: "center",
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
};

/**
 * AvatarsLayer
 * Always-visible layer showing speaker avatars
 * Highlights active speaker based on current segment
 */
interface AvatarsLayerProps {
  speakers: Speaker[];
  segments: ParsedScript["segments"];
}

const AvatarsLayer: React.FC<AvatarsLayerProps> = ({ speakers, segments }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Find currently active segment
  const activeSegment = segments.find(
    (segment) => currentTime >= segment.startTime && currentTime < segment.endTime
  );

  const activeSpeakerId = activeSegment?.speakerId;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "flex-end",
        paddingBottom: "40px",
      }}
    >
      {speakers.map((speaker) => (
        <AvatarComponent
          key={speaker.id}
          speaker={speaker}
          isActive={speaker.id === activeSpeakerId}
        />
      ))}
    </div>
  );
};

/**
 * VisualComponentRenderer
 * Renders the appropriate visual component based on type
 */
interface VisualComponentRendererProps {
  visualComponent: NonNullable<ParsedScript["segments"][0]["visualComponent"]>;
}

const VisualComponentRenderer: React.FC<VisualComponentRendererProps> = ({
  visualComponent,
}) => {
  return (
    <>
      {visualComponent.type === "news-list" && (
        <NewsListComponent data={visualComponent.data} />
      )}
      {visualComponent.type === "concept-explanation" && (
        <ConceptExplanationComponent data={visualComponent.data} />
      )}
      {visualComponent.type === "conversation-summary" && (
        <ConversationSummaryComponent data={visualComponent.data} />
      )}
    </>
  );
};
