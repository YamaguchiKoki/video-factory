/**
 * VideoComposition
 * すべてのビジュアル要素を統合するメインコンポジションコンポーネント
 * 音声の同期、セグメントのタイミング、アバターの状態制御を処理
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
  const audioSource = audioPath ? staticFile(audioPath) : undefined;

  return (
    <AbsoluteFill>
      {/* 背景 */}
      <AbsoluteFill className="bg-slate-100" />

      {/* オーディオトラック */}
      {audioSource && <Audio src={audioSource} volume={1} />}

      {/* メインコンテンツエリア */}
      <AbsoluteFill className="flex flex-col justify-between p-10">
        {/* セグメントエリア（中央） */}
        <div className="flex-1 flex items-center justify-center mb-40">
          {script.segments.map((segment) => (
            <SegmentSequence
              key={segment.id}
              segment={segment}
              speakers={speakers}
              fps={fps}
            />
          ))}
        </div>

        {/* アバター（下部） - 常に表示 */}
        <AvatarsLayer speakers={speakers} segments={script.segments} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * SegmentSequence
 * セグメントのSequenceラッパー
 */
interface SegmentSequenceProps {
  segment: ParsedScript["segments"][0];
  speakers: Speaker[];
  fps: number;
}

const SegmentSequence: React.FC<SegmentSequenceProps> = ({
  segment,
  speakers,
  fps,
}) => {
  const startFrame = Math.floor(segment.startTime * fps);
  const endFrame = Math.floor(segment.endTime * fps);
  const durationInFrames = endFrame - startFrame;
  const premountFor = Math.floor(1 * fps);

  return (
    <Sequence
      from={startFrame}
      durationInFrames={durationInFrames}
      premountFor={premountFor}
    >
      <SegmentContent segment={segment} speakers={speakers} />
    </Sequence>
  );
};

/**
 * SegmentContent
 * フェードインアニメーション付きで単一セグメントのコンテンツをレンダリング
 */
interface SegmentContentProps {
  segment: ParsedScript["segments"][0];
  speakers: Speaker[];
}

const SegmentContent: React.FC<SegmentContentProps> = ({ segment, speakers }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 0.3秒かけてフェードイン
  const fadeInDuration = 0.3 * fps;
  const opacity = interpolate(frame, [0, fadeInDuration], [0, 1], {
    extrapolateRight: "clamp",
  });

  // スケールアニメーション
  const scale = interpolate(frame, [0, fadeInDuration], [0.95, 1], {
    extrapolateRight: "clamp",
  });

  const hasVisualComponent = !!segment.visualComponent;

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {hasVisualComponent ? (
        <VisualComponentRenderer visualComponent={segment.visualComponent!} />
      ) : (
        <TextDisplay text={segment.text} speakerId={segment.speakerId} speakers={speakers} />
      )}
    </div>
  );
};

/**
 * VisualComponentRenderer
 * タイプに応じて適切なビジュアルコンポーネントをレンダリング
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

/**
 * TextDisplay
 * 話者名付きでセグメントテキストを表示
 */
interface TextDisplayProps {
  text: string;
  speakerId: string;
  speakers: Speaker[];
}

const findSpeaker = (speakers: Speaker[], speakerId: string): Speaker | undefined => {
  return speakers.find((s) => s.id === speakerId);
};

const TextDisplay: React.FC<TextDisplayProps> = ({ text, speakerId, speakers }) => {
  const speaker = findSpeaker(speakers, speakerId);
  const hasSpeaker = !!speaker;

  return (
    <div className="max-w-[1200px] p-12 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.1)]">
      {hasSpeaker && (
        <div className="text-xl font-semibold text-slate-500 mb-4">
          {speaker.name}
        </div>
      )}
      <p className="text-[32px] font-semibold text-slate-800 leading-relaxed text-center m-0">
        {text}
      </p>
    </div>
  );
};

/**
 * AvatarsLayer
 * 話者アバターを表示する常時表示レイヤー
 * 現在のセグメントに基づいてアクティブな話者をハイライト
 */
interface AvatarsLayerProps {
  speakers: Speaker[];
  segments: ParsedScript["segments"];
}

const findActiveSegment = (
  segments: ParsedScript["segments"],
  currentTime: number
): ParsedScript["segments"][0] | undefined => {
  return segments.find(
    (segment) => currentTime >= segment.startTime && currentTime < segment.endTime
  );
};

const AvatarsLayer: React.FC<AvatarsLayerProps> = ({ speakers, segments }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // 現在アクティブなセグメントを検索
  const activeSegment = findActiveSegment(segments, currentTime);
  const activeSpeakerId = activeSegment?.speakerId;

  return (
    <div className="flex justify-around items-end pb-10">
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
