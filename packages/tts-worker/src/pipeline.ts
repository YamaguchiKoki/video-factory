import { Effect } from "effect";
import type { S3Error, VoicevoxError, WavError } from "./errors.js";
import { extractDateFromKey } from "./s3.js";
import type {
  DiscussionSection,
  EnrichedLine,
  EnrichedScript,
  Line,
  Script,
} from "./schema.js";
import { getSpeakerId } from "./speaker.js";
import { StorageService } from "./storage.js";
import { VoicevoxService } from "./voicevox.js";
import { concatenateWavs, getWavDurationSec } from "./wav.js";

type PipelineError = VoicevoxError | S3Error | WavError;

export const runPipeline = (
  scriptKey: string,
): Effect.Effect<
  EnrichedScript,
  PipelineError,
  StorageService | VoicevoxService
> =>
  Effect.gen(function* () {
    const storage = yield* StorageService;

    const script = yield* storage.getScript(scriptKey);

    const allLines = flattenScriptLines(script);
    const {
      enrichedLines,
      wavBuffers,
      offsetSec: totalDurationSec,
    } = yield* processLines(allLines, 0);

    const combinedWav = yield* concatenateWavs(wavBuffers);

    const date = extractDateFromKey(scriptKey);
    const outputWavKey = storage.buildOutputKey(date, script.title);

    yield* storage.uploadWav(outputWavKey, combinedWav);

    const enrichedScript = rebuildEnrichedScript(
      script,
      enrichedLines,
      outputWavKey,
      totalDurationSec,
    );

    yield* storage.uploadEnrichedScript(enrichedScript);

    return enrichedScript;
  });

type LineResult = {
  readonly enrichedLine: EnrichedLine;
  readonly wavBuffer: ArrayBuffer;
  readonly nextOffset: number;
};

const processLine = (
  line: Line,
  offsetSec: number,
): Effect.Effect<LineResult, PipelineError, VoicevoxService> =>
  Effect.gen(function* () {
    const voicevox = yield* VoicevoxService;
    const speakerId = getSpeakerId(line.speaker);
    const query = yield* voicevox.audioQuery(line.text, speakerId);
    const wavBuffer = yield* voicevox.synthesis(speakerId, query);
    const durationSec = yield* getWavDurationSec(wavBuffer);
    return {
      enrichedLine: {
        speaker: line.speaker,
        text: line.text,
        voicevoxSpeakerId: speakerId,
        offsetSec,
        durationSec,
      },
      wavBuffer,
      nextOffset: offsetSec + durationSec,
    };
  });

type LinesAccumulator = {
  readonly enrichedLines: readonly EnrichedLine[];
  readonly wavBuffers: readonly ArrayBuffer[];
  readonly offsetSec: number;
};

const processLines = (
  lines: readonly Line[],
  initialOffset: number,
): Effect.Effect<LinesAccumulator, PipelineError, VoicevoxService> =>
  lines.reduce(
    (
      accEffect: Effect.Effect<
        LinesAccumulator,
        PipelineError,
        VoicevoxService
      >,
      line,
    ) =>
      accEffect.pipe(
        Effect.flatMap((acc) =>
          processLine(line, acc.offsetSec).pipe(
            Effect.map(({ enrichedLine, wavBuffer, nextOffset }) => ({
              enrichedLines: [...acc.enrichedLines, enrichedLine],
              wavBuffers: [...acc.wavBuffers, wavBuffer],
              offsetSec: nextOffset,
            })),
          ),
        ),
      ),
    Effect.succeed<LinesAccumulator>({
      enrichedLines: [],
      wavBuffers: [],
      offsetSec: initialOffset,
    }),
  );

const flattenDiscussionLines = (disc: DiscussionSection): readonly Line[] =>
  disc.blocks.flatMap((b) => b.lines);

const flattenScriptLines = (script: Script): readonly Line[] => {
  const [intro, disc1, disc2, disc3, outro] = script.sections;

  return [
    ...intro.greeting,
    ...intro.newsOverview,
    ...flattenDiscussionLines(disc1),
    ...flattenDiscussionLines(disc2),
    ...flattenDiscussionLines(disc3),
    ...outro.recap,
    ...outro.closing,
  ];
};

type CursorState = {
  readonly cursor: number;
  readonly lines: readonly EnrichedLine[];
};

const takeLines = (
  state: CursorState,
  count: number,
): { taken: EnrichedLine[]; next: CursorState } => ({
  taken: state.lines.slice(state.cursor, state.cursor + count),
  next: { ...state, cursor: state.cursor + count },
});

type DiscussionBlocksTaken = {
  readonly b0Lines: EnrichedLine[];
  readonly b1Lines: EnrichedLine[];
  readonly b2Lines: EnrichedLine[];
  readonly next: CursorState;
};

const takeDiscussionBlocks = (
  state: CursorState,
  disc: DiscussionSection,
): DiscussionBlocksTaken => {
  const { taken: b0Lines, next: s1 } = takeLines(
    state,
    disc.blocks[0].lines.length,
  );
  const { taken: b1Lines, next: s2 } = takeLines(
    s1,
    disc.blocks[1].lines.length,
  );
  const { taken: b2Lines, next: s3 } = takeLines(
    s2,
    disc.blocks[2].lines.length,
  );
  return { b0Lines, b1Lines, b2Lines, next: s3 };
};

const rebuildEnrichedScript = (
  script: Script,
  enrichedLines: readonly EnrichedLine[],
  outputWavKey: string,
  totalDurationSec: number,
): EnrichedScript => {
  const [intro, disc1, disc2, disc3, outro] = script.sections;

  const s0: CursorState = { cursor: 0, lines: enrichedLines };

  const { taken: greeting, next: s1 } = takeLines(s0, intro.greeting.length);
  const { taken: newsOverview, next: s2 } = takeLines(
    s1,
    intro.newsOverview.length,
  );

  const {
    b0Lines: d1b0Lines,
    b1Lines: d1b1Lines,
    b2Lines: d1b2Lines,
    next: s3,
  } = takeDiscussionBlocks(s2, disc1);
  const {
    b0Lines: d2b0Lines,
    b1Lines: d2b1Lines,
    b2Lines: d2b2Lines,
    next: s4,
  } = takeDiscussionBlocks(s3, disc2);
  const {
    b0Lines: d3b0Lines,
    b1Lines: d3b1Lines,
    b2Lines: d3b2Lines,
    next: s5,
  } = takeDiscussionBlocks(s4, disc3);

  const { taken: recap, next: s6 } = takeLines(s5, outro.recap.length);
  const { taken: closing } = takeLines(s6, outro.closing.length);

  return {
    title: script.title,
    totalDurationSec,
    outputWavS3Key: outputWavKey,
    newsItems: script.newsItems,
    sections: [
      {
        type: "intro",
        greeting,
        newsOverview,
      },
      {
        type: "discussion",
        newsId: disc1.newsId,
        blocks: [
          { phase: disc1.blocks[0].phase, lines: d1b0Lines },
          { phase: disc1.blocks[1].phase, lines: d1b1Lines },
          { phase: disc1.blocks[2].phase, lines: d1b2Lines },
        ],
      },
      {
        type: "discussion",
        newsId: disc2.newsId,
        blocks: [
          { phase: disc2.blocks[0].phase, lines: d2b0Lines },
          { phase: disc2.blocks[1].phase, lines: d2b1Lines },
          { phase: disc2.blocks[2].phase, lines: d2b2Lines },
        ],
      },
      {
        type: "discussion",
        newsId: disc3.newsId,
        blocks: [
          { phase: disc3.blocks[0].phase, lines: d3b0Lines },
          { phase: disc3.blocks[1].phase, lines: d3b1Lines },
          { phase: disc3.blocks[2].phase, lines: d3b2Lines },
        ],
      },
      {
        type: "outro",
        recap,
        closing,
      },
    ],
  };
};
