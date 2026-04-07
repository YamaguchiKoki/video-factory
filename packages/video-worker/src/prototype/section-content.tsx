import type React from "react";
import type { SectionMarker, VideoProps } from "../schema/schema";
import { IntroContent } from "./sections/intro-content";
import type { SectionVisualConfig } from "./visual-config";

interface SectionContentProps {
  marker: SectionMarker;
  config: SectionVisualConfig;
  newsItems: VideoProps["newsItems"];
}

/**
 * Polymorphic component that renders center content based on marker type.
 * Labels are rendered separately in composition.tsx.
 * Uses discriminated union exhaustiveness checking for type safety.
 */
export const SectionContent: React.FC<SectionContentProps> = ({
  marker,
  config,
}) => {
  switch (marker.type) {
    case "intro":
      return <IntroContent marker={marker} config={config} />;

    case "discussion":
      // No center content for discussion (label is shown separately)
      return null;

    case "outro":
      // No center content for outro (label is shown separately)
      return null;

    default:
      // Exhaustiveness check: ensures all marker types are handled
      return marker satisfies never;
  }
};
