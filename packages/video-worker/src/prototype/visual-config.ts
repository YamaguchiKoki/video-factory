import { SectionMarker } from "../schema/schema";

export interface SectionVisualConfig {
  backgroundColor: string;
  accentColor: string;
  label: string;
  /** 話者Aの字幕色 */
  speakerAColor: string;
  /** 話者Bの字幕色 */
  speakerBColor: string;
}

/**
 * セクションのtype + phaseから固定のビジュアル設定を返す
 * 演出を変えたくなったらここだけ触ればOK
 * TODO: パターンマッチングにリファクタする
 */
export function getVisualConfig(marker: SectionMarker): SectionVisualConfig {
  switch (marker.type) {
    case "intro":
      return {
        backgroundColor: "#0f0f1a",
        accentColor: "#6366f1",
        label: "イントロ",
        speakerAColor: "#a5b4fc",
        speakerBColor: "#fbbf24",
      };

    case "discussion":
      switch (marker.phase) {
        case "summary":
          return {
            backgroundColor: "#0a1628",
            accentColor: "#3b82f6",
            label: "概要",
            speakerAColor: "#93c5fd",
            speakerBColor: "#fbbf24",
          };
        case "background":
          return {
            backgroundColor: "#0f1d0f",
            accentColor: "#22c55e",
            label: "前提知識",
            speakerAColor: "#86efac",
            speakerBColor: "#fbbf24",
          };
        case "deepDive":
          return {
            backgroundColor: "#1a0a1e",
            accentColor: "#a855f7",
            label: "掘り下げ",
            speakerAColor: "#c4b5fd",
            speakerBColor: "#fbbf24",
          };
        default:
          return marker.phase satisfies never;
      }

    case "outro":
      return {
        backgroundColor: "#1a0f0a",
        accentColor: "#f97316",
        label: "まとめ",
        speakerAColor: "#fdba74",
        speakerBColor: "#fbbf24",
      };
  }
}

/** ニュースIDからタイトルを引く */
export function getNewsTitle(
  newsId: string,
  newsItems: { id: string; title: string }[],
): string | undefined {
  return newsItems.find((n) => n.id === newsId)?.title;
}
