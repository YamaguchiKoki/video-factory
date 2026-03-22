import { fromThrowable, ok, err, Result } from "neverthrow";
import { EnrichedScript, EnrichedLine, EnrichedScriptSchema } from "../schema/enriched-schema";
import {
  VideoProps,
  TimedLine,
  SectionMarker,
  IntroSectionMarker,
} from "../schema/schema";
import { ValidationError, createValidationError } from "./errors";

// ---------------------------------------------------------------------------
// JSON parsing
// ---------------------------------------------------------------------------

const safeJsonParse = fromThrowable(
  JSON.parse,
  (e): Error => (e instanceof Error ? e : new Error(String(e))),
);

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

const lastOf = <T>(arr: T[]): T => arr[arr.length - 1];

const endSecOf = (line: EnrichedLine): number => line.offsetSec + line.durationSec;

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
    } else {
      return [...section.recap, ...section.closing].map((l) =>
        toTimedLine(l, audioPath),
      );
    }
  });

const sectionToMarkers = (
  section: EnrichedScript["sections"][number],
  newsItems: IntroSectionMarker["agenda"],
): Result<SectionMarker[], ValidationError> => {
  if (section.type === "intro") {
    const allLines = [...section.greeting, ...section.newsOverview];
    if (allLines.length === 0) {
      return err(
        createValidationError(
          "SCHEMA_VALIDATION_ERROR",
          "intro section has no lines",
          null,
          { sectionType: "intro" },
        ),
      );
    }
    return ok([
      {
        type: "intro",
        startSec: allLines[0].offsetSec,
        endSec: endSecOf(lastOf(allLines)),
        agenda: newsItems,
      },
    ]);
  } else if (section.type === "discussion") {
    return ok(
      section.blocks.map((block) => ({
        type: "discussion" as const,
        newsId: section.newsId,
        phase: block.phase,
        startSec: block.lines[0].offsetSec,
        endSec: endSecOf(lastOf(block.lines)),
      })),
    );
  } else {
    const allLines = [...section.recap, ...section.closing];
    if (allLines.length === 0) {
      return err(
        createValidationError(
          "SCHEMA_VALIDATION_ERROR",
          "outro section has no lines",
          null,
          { sectionType: "outro" },
        ),
      );
    }
    return ok([
      {
        type: "outro",
        startSec: allLines[0].offsetSec,
        endSec: endSecOf(lastOf(allLines)),
      },
    ]);
  }
};

const buildSectionMarkers = (
  script: EnrichedScript,
  newsItems: IntroSectionMarker["agenda"],
): Result<SectionMarker[], ValidationError> =>
  script.sections.reduce(
    (acc: Result<SectionMarker[], ValidationError>, section) =>
      acc.andThen((markers) =>
        sectionToMarkers(section, newsItems).map((newMarkers) => [
          ...markers,
          ...newMarkers,
        ]),
      ),
    ok([]),
  );

const toVideoProps = (
  script: EnrichedScript,
  wavPath: string,
): Result<VideoProps, ValidationError> => {
  const newsItems = script.newsItems.map((n) => ({ id: n.id, title: n.title }));
  return buildSectionMarkers(script, newsItems).map((sectionMarkers) => ({
    title: script.title,
    totalDurationSec: script.totalDurationSec,
    newsItems,
    lines: flattenLines(script, wavPath),
    sectionMarkers,
  }));
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const parseEnrichedScript = (
  jsonContent: string,
  wavPath: string,
): Result<VideoProps, ValidationError> =>
  safeJsonParse(jsonContent)
    .mapErr((e): ValidationError =>
      createValidationError("JSON_PARSE_ERROR", e.message, e, {}),
    )
    .andThen((raw): Result<VideoProps, ValidationError> => {
      const parsed = EnrichedScriptSchema.safeParse(raw);
      if (!parsed.success) {
        return err(
          createValidationError("SCHEMA_VALIDATION_ERROR", parsed.error.message, null, {}),
        );
      }
      return toVideoProps(parsed.data, wavPath);
    });
