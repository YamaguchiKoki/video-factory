/**
 * ConceptExplanationComponent
 * 異なる可視化テンプレートでコンセプト説明を表示
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

  // エントランスアニメーション
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
      className="p-12 max-w-[1000px] mx-auto"
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      {/* タイトル */}
      <h2 className="text-4xl font-bold text-slate-800 mb-8 text-center border-b-[3px] border-blue-500 pb-4">
        {data.title}
      </h2>

      {/* テンプレート固有のレンダリング */}
      {data.template === "bullet-points" && (
        <BulletPointsTemplate data={data} />
      )}
      {data.template === "flowchart" && <FlowchartTemplate data={data} />}
      {data.template === "timeline" && <TimelineTemplate data={data} />}
    </div>
  );
};

// 強調スタイルクラスの定義
const getEmphasisClassName = (emphasis?: "high" | "medium" | "low"): string => {
  const baseClass = "leading-relaxed";
  if (emphasis === "high")
    return `${baseClass} text-red-600 text-2xl font-bold`;
  if (emphasis === "low")
    return `${baseClass} text-slate-600 text-xl font-medium`;
  return `${baseClass} text-slate-800 text-[22px] font-semibold`;
};

const getBulletColor = (emphasis?: "high" | "medium" | "low"): string => {
  return emphasis === "high" ? "#dc2626" : "#3b82f6";
};

// 箇条書きテンプレート
const BulletPointsTemplate: React.FC<{ data: ConceptExplanationData }> = ({
  data,
}) => {
  return (
    <div className="flex flex-col gap-5">
      {data.bulletPoints?.map((point, index) => (
        <BulletPoint key={point.text} point={point} index={index} />
      ))}
    </div>
  );
};

interface BulletPointProps {
  point: NonNullable<ConceptExplanationData["bulletPoints"]>[0];
  index: number;
}

const BulletPoint: React.FC<BulletPointProps> = ({ point, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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

  const emphasisClassName = getEmphasisClassName(point.emphasis);
  const bulletColor = getBulletColor(point.emphasis);

  return (
    <div
      className="flex items-start gap-4"
      style={{
        opacity: pointOpacity,
        transform: `translateX(${pointTranslateX}px)`,
      }}
    >
      <div
        className="w-3 h-3 rounded-full mt-2 flex-shrink-0"
        style={{ backgroundColor: bulletColor }}
      />
      <p className={emphasisClassName}>{point.text}</p>
    </div>
  );
};

// フローチャートテンプレート
const FlowchartTemplate: React.FC<{ data: ConceptExplanationData }> = ({
  data,
}) => {
  return (
    <div className="flex flex-col gap-6 items-center">
      {data.flowchartNodes?.map((node, index) => (
        <FlowchartNode key={`node-${node.id}`} node={node} index={index} />
      ))}
    </div>
  );
};

interface FlowchartNodeProps {
  node: NonNullable<ConceptExplanationData["flowchartNodes"]>[0];
  index: number;
}

const FlowchartNode: React.FC<FlowchartNodeProps> = ({ node, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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

  const hasConnections = node.connections.length > 0;

  return (
    <div className="text-center">
      <div
        className="bg-blue-500 text-white py-5 px-10 rounded-xl text-xl font-semibold shadow-[0_4px_12px_rgba(59,130,246,0.3)] min-w-[200px]"
        style={{
          opacity: nodeOpacity,
          transform: `scale(${nodeScale})`,
        }}
      >
        {node.label}
      </div>
      {hasConnections && <div className="w-0.5 h-8 bg-slate-400 mx-auto" />}
    </div>
  );
};

// タイムラインテンプレート
const TimelineTemplate: React.FC<{ data: ConceptExplanationData }> = ({
  data,
}) => {
  return (
    <div className="flex flex-col gap-8 relative">
      {/* タイムライン線 */}
      <div className="absolute left-10 top-0 bottom-0 w-[3px] bg-slate-300" />

      {data.timelineEvents?.map((event, index) => (
        <TimelineEvent
          key={`${event.date}-${event.label}`}
          event={event}
          index={index}
        />
      ))}
    </div>
  );
};

interface TimelineEventProps {
  event: NonNullable<ConceptExplanationData["timelineEvents"]>[0];
  index: number;
}

const TimelineEvent: React.FC<TimelineEventProps> = ({ event, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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

  const hasDescription = !!event.description;

  return (
    <div
      className="flex gap-6 items-start relative"
      style={{
        opacity: eventOpacity,
        transform: `translateX(${eventTranslateX}px)`,
      }}
    >
      {/* タイムラインドット */}
      <div className="w-5 h-5 rounded-full bg-blue-500 border-4 border-white shadow-[0_2px_8px_rgba(59,130,246,0.4)] ml-[31px] mt-1 flex-shrink-0 z-10" />
      <div className="flex-1">
        <div className="text-base font-semibold text-blue-500 mb-1">
          {event.date}
        </div>
        <div className="text-[22px] font-bold text-slate-800 mb-2">
          {event.label}
        </div>
        {hasDescription && (
          <div className="text-lg text-slate-500 leading-relaxed">
            {event.description}
          </div>
        )}
      </div>
    </div>
  );
};
