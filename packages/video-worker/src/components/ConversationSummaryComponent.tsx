/**
 * ConversationSummaryComponent
 * 重要度に基づくハイライト付きで会話のまとめとキーポイントを表示
 */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ConversationSummaryData } from "../core/script-types";

interface ConversationSummaryComponentProps {
  data: ConversationSummaryData;
}

// 重要度スタイルの定義
const IMPORTANCE_STYLES = {
  high: {
    className: "text-red-600 text-[22px] font-bold bg-red-50 border-red-600",
    iconColor: "#dc2626",
  },
  medium: {
    className: "text-slate-800 text-xl font-semibold bg-white border-blue-500",
    iconColor: "#3b82f6",
  },
  low: {
    className:
      "text-slate-500 text-lg font-medium bg-slate-50 border-slate-400",
    iconColor: "#94a3b8",
  },
} as const;

const getImportanceIcon = (importance: "high" | "medium" | "low"): string => {
  if (importance === "high") return "!";
  if (importance === "medium") return "●";
  return "◦";
};

export const ConversationSummaryComponent: React.FC<
  ConversationSummaryComponentProps
> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // コンポーネント全体のエントランスアニメーション
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

  const hasKeyPoints = data.keyPoints.length > 0;

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
        まとめ
      </h2>

      {/* まとめテキスト */}
      <div className="text-2xl font-semibold text-slate-700 leading-[1.8] mb-10 p-6 bg-slate-50 rounded-xl border-l-4 border-blue-500">
        {data.summaryText}
      </div>

      {/* キーポイント */}
      {hasKeyPoints && (
        <div className="flex flex-col gap-5">
          <h3 className="text-2xl font-bold text-slate-600 mb-2">ポイント</h3>
          {data.keyPoints.map((point, index) => (
            <KeyPoint key={point.text} point={point} index={index} />
          ))}
        </div>
      )}
    </div>
  );
};

interface KeyPointProps {
  point: ConversationSummaryData["keyPoints"][0];
  index: number;
}

const KeyPoint: React.FC<KeyPointProps> = ({ point, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 各キーポイントのシーケンシャルアニメーション
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

  const style = IMPORTANCE_STYLES[point.importance];
  const icon = getImportanceIcon(point.importance);

  return (
    <div
      className={`flex items-start gap-4 p-5 rounded-xl border-2 ${style.className}`}
      style={{
        opacity: pointOpacity,
        transform: `translateX(${pointTranslateX}px)`,
      }}
    >
      {/* 重要度インジケーターアイコン */}
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5"
        style={{ backgroundColor: style.iconColor }}
      >
        {icon}
      </div>

      {/* キーポイントテキスト */}
      <p className="leading-relaxed">{point.text}</p>
    </div>
  );
};
