import { parseWithZodEffect } from "@video-factory/shared";
import { Effect } from "effect";
import {
  type EnrichedLine,
  type EnrichedScript,
  EnrichedScriptSchema,
} from "../schema/enriched-schema";
import type {
  IntroSectionMarker,
  SectionMarker,
  TimedLine,
  VideoProps,
} from "../schema/schema";
import { ValidationError } from "./errors";

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

const toTimedLine = (line: EnrichedLine, audioPath: string): TimedLine => ({
  speaker: line.speaker,
  text: line.text,
  audioPath,
  startSec: line.offsetSec,
  durationSec: line.durationSec,
});

const lastOf = <T>(arr: readonly T[]): T => arr[arr.length - 1] as T;

const endSecOf = (line: EnrichedLine): number =>
  line.offsetSec + line.durationSec;

const flattenLines = (script: EnrichedScript, audioPath: string): TimedLine[] =>
  script.sections.flatMap((section) => {
    if (section.type === "intro") {
      return [...section.greeting, ...section.newsOverview].map((l) =>
        toTimedLine(l, audioPath),
      );
    } else if (section.type === "discussion") {
      return section.blocks.flatMap((block) =>
        block.lines.map((l) => toTimedLine(l, audioPath)),
      );
    } else if (section.type === "outro") {
      return [...section.recap, ...section.closing].map((l) =>
        toTimedLine(l, audioPath),
      );
    } else {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  });

const sectionToMarkers = (
  section: EnrichedScript["sections"][number],
  newsItems: IntroSectionMarker["agenda"],
): Effect.Effect<SectionMarker[], ValidationError> => {
  if (section.type === "intro") {
    const allLines = [...section.greeting, ...section.newsOverview];
    if (allLines.length === 0) {
      return Effect.fail(
        new ValidationError({ message: "intro section has no lines" }),
      );
    }
    return Effect.succeed([
      {
        type: "intro",
        startSec: allLines[0].offsetSec,
        endSec: endSecOf(lastOf(allLines)),
        agenda: newsItems,
      },
    ]);
  } else if (section.type === "discussion") {
    return Effect.succeed(
      section.blocks.map((block) => ({
        type: "discussion" as const,
        newsId: section.newsId,
        phase: block.phase,
        startSec: block.lines[0].offsetSec,
        endSec: endSecOf(lastOf(block.lines)),
      })),
    );
  } else if (section.type === "outro") {
    const allLines = [...section.recap, ...section.closing];
    if (allLines.length === 0) {
      return Effect.fail(
        new ValidationError({ message: "outro section has no lines" }),
      );
    }
    return Effect.succeed([
      {
        type: "outro",
        startSec: allLines[0].offsetSec,
        endSec: endSecOf(lastOf(allLines)),
      },
    ]);
  } else {
    const _exhaustive: never = section;
    return _exhaustive;
  }
};

const buildSectionMarkers = (
  script: EnrichedScript,
  newsItems: IntroSectionMarker["agenda"],
): Effect.Effect<SectionMarker[], ValidationError> =>
  script.sections.reduce(
    (accEffect: Effect.Effect<SectionMarker[], ValidationError>, section) =>
      accEffect.pipe(
        Effect.flatMap((markers) =>
          sectionToMarkers(section, newsItems).pipe(
            Effect.map((newMarkers) => [...markers, ...newMarkers]),
          ),
        ),
      ),
    Effect.succeed<SectionMarker[]>([]),
  );

const toVideoProps = (
  script: EnrichedScript,
  wavPath: string,
): Effect.Effect<VideoProps, ValidationError> => {
  const newsItems = script.newsItems.map((n) => ({ id: n.id, title: n.title }));
  return buildSectionMarkers(script, newsItems).pipe(
    Effect.map((sectionMarkers) => ({
      title: script.title,
      totalDurationSec: script.totalDurationSec,
      newsItems,
      lines: flattenLines(script, wavPath),
      sectionMarkers,
    })),
  );
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const parseEnrichedScript = (
  jsonContent: string,
  wavPath: string,
): Effect.Effect<VideoProps, ValidationError> =>
  Effect.try({
    try: () => JSON.parse(jsonContent) as unknown,
    catch: (e) =>
      new ValidationError({
        message: e instanceof Error ? e.message : String(e),
        cause: e,
      }),
  }).pipe(
    Effect.flatMap((raw) =>
      parseWithZodEffect(EnrichedScriptSchema, raw).pipe(
        Effect.mapError(
          (e) =>
            new ValidationError({
              message: e.message,
            }),
        ),
      ),
    ),
    Effect.flatMap((script) => toVideoProps(script, wavPath)),
  );
