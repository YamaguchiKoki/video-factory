import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { VideoProps } from "../schema/schema";
import { SectionBackground } from "./section-background";
import { SectionContent } from "./section-content";
import { SectionLabel } from "./section-label";
import { Subtitle } from "./subtitle";
import { getVisualConfig } from "./visual-config";

export const VideoComposition2: React.FC<VideoProps> = ({
  newsItems,
  lines,
  sectionMarkers,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      {/* ========= セクション背景 ========= */}
      {sectionMarkers.map((marker) => {
        const fromFrame = Math.round(marker.startSec * fps);
        const durationFrames = Math.round(
          (marker.endSec - marker.startSec) * fps,
        );
        const config = getVisualConfig(marker);

        return (
          <Sequence
            key={`section-bg-${marker.type}-${marker.startSec}`}
            from={fromFrame}
            durationInFrames={durationFrames}
          >
            <SectionBackground config={config} />
          </Sequence>
        );
      })}

      {/* ========= セクションラベル（左上固定） ========= */}
      {sectionMarkers.map((marker) => {
        const fromFrame = Math.round(marker.startSec * fps);
        const durationFrames = Math.round(
          (marker.endSec - marker.startSec) * fps,
        );
        const config = getVisualConfig(marker);
        const newsTitle =
          marker.type === "discussion"
            ? newsItems.find((n) => n.id === marker.newsId)?.title
            : undefined;

        return (
          <Sequence
            key={`section-label-${marker.type}-${marker.startSec}`}
            from={fromFrame}
            durationInFrames={durationFrames}
          >
            <SectionLabel config={config} newsTitle={newsTitle} />
          </Sequence>
        );
      })}

      {/* ========= セクションコンテンツ（中央） ========= */}
      {sectionMarkers.map((marker) => {
        const fromFrame = Math.round(marker.startSec * fps);
        const durationFrames = Math.round(
          (marker.endSec - marker.startSec) * fps,
        );
        const config = getVisualConfig(marker);

        return (
          <Sequence
            key={`section-content-${marker.type}-${marker.startSec}`}
            from={fromFrame}
            durationInFrames={durationFrames}
          >
            <SectionContent
              marker={marker}
              config={config}
              newsItems={newsItems}
            />
          </Sequence>
        );
      })}

      {/* ========= 音声 + 字幕 ========= */}
      {lines.map((line) => {
        const fromFrame = Math.round(line.startSec * fps);
        const durationFrames = Math.round(line.durationSec * fps);

        // この発話が属するセクションのビジュアル設定を取得
        const marker = sectionMarkers.find(
          (m) => line.startSec >= m.startSec && line.startSec < m.endSec,
        );
        const config = marker
          ? getVisualConfig(marker)
          : getVisualConfig({ type: "intro", startSec: 0, endSec: 0 });

        return (
          <Sequence
            key={`line`}
            from={fromFrame}
            durationInFrames={durationFrames}
          >
            <Audio src={staticFile(line.audioPath)} />
            <Subtitle line={line} config={config} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
