import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { VideoProps } from "../schema/schema";
import { SectionBackground } from "./section-background";
import { SectionLabel } from "./section-label";
import { Subtitle } from "./subtitle";
import { getNewsTitle, getVisualConfig } from "./visual-config";

export const VideoComposition2: React.FC<VideoProps> = ({
  newsItems,
  lines,
  sectionMarkers,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      {/* ========= セクション背景 + ラベル ========= */}
      {sectionMarkers.map((marker) => {
        const fromFrame = Math.round(marker.startSec * fps);
        const durationFrames = Math.round(
          (marker.endSec - marker.startSec) * fps,
        );
        const config = getVisualConfig(marker);
        const newsTitle =
          marker.type === "discussion"
            ? getNewsTitle(marker.newsId, newsItems)
            : undefined;

        return (
          <Sequence
            key={`bg`}
            from={fromFrame}
            durationInFrames={durationFrames}
          >
            <SectionBackground config={config} />
            <SectionLabel config={config} newsTitle={newsTitle} />
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
