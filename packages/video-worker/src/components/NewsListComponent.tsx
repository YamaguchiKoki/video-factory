/**
 * NewsListComponent
 * シーケンシャルアニメーション付きでニュースアイテムのリストを表示
 */

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { NewsListData } from "../core/script-types";

interface NewsListComponentProps {
  data: NewsListData;
}

// カテゴリカラーマッピング
const CATEGORY_COLORS: Record<string, string> = {
  政治: "#dc2626",
  経済: "#2563eb",
  テクノロジー: "#7c3aed",
  環境: "#059669",
  社会: "#f59e0b",
};

const getCategoryColor = (category: string): string => {
  return CATEGORY_COLORS[category] || "#64748b";
};

export const NewsListComponent: React.FC<NewsListComponentProps> = ({
  data,
}) => {
  return (
    <div className="flex flex-col gap-4 p-8 max-w-[800px] mx-auto">
      <h2 className="text-[32px] font-bold text-slate-800 mb-4 text-center">
        今日のニュース
      </h2>
      {data.items.map((item, index) => (
        <NewsItem key={`${item.category}-${item.date}-${item.title}`} item={item} index={index} />
      ))}
    </div>
  );
};

interface NewsItemProps {
  item: NewsListData["items"][0];
  index: number;
}

const NewsItem: React.FC<NewsItemProps> = ({ item, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // シーケンシャルアニメーション: 各アイテムは前のアイテムの0.3秒後に開始
  const delayFrames = index * 0.3 * fps;
  const itemProgress = spring({
    frame: frame - delayFrames,
    fps,
    config: { damping: 200 },
  });

  // フェードイン + スライドアップアニメーション
  const opacity = interpolate(itemProgress, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(itemProgress, [0, 1], [20, 0], {
    extrapolateRight: "clamp",
  });

  const categoryColor = getCategoryColor(item.category);

  return (
    <div
      className="bg-white rounded-xl p-6 shadow-md border border-slate-200 flex flex-col gap-3"
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="text-white text-sm font-semibold px-3 py-1 rounded-2xl"
          style={{ backgroundColor: categoryColor }}
        >
          {item.category}
        </span>
        <span className="text-sm text-slate-400">
          {item.date}
        </span>
      </div>
      <h3 className="text-xl font-semibold text-slate-800 leading-normal">
        {item.title}
      </h3>
    </div>
  );
};
