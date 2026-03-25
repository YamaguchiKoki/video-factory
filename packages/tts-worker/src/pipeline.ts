import { ok, okAsync, safeTry, type ResultAsync } from "neverthrow";
import type { DiscussionSection, EnrichedLine, EnrichedScript, Line, Script } from "./schema.js";
import type { S3Error, VoicevoxError, WavError } from "./errors.js";
import type { StorageDeps } from "./storage.js";
import { getSpeakerId } from "./speaker.js";
import { audioQuery, synthesis } from "./voicevox.js";
import { concatenateWavs, getWavDurationSec } from "./wav.js";
import { extractDateFromKey } from "./s3.js";

export type PipelineError = VoicevoxError | S3Error | WavError;

export const runPipeline = (
  storage: StorageDeps,
  scriptKey: string,
): ResultAsync<EnrichedScript, PipelineError> =>
  safeTry(async function* () {
    const script = yield* storage.getScript(scriptKey).mapErr(
      (e): PipelineError => e,
    );

    const allLines = flattenScriptLines(script);
    const { enrichedLines, wavBuffers, offsetSec: totalDurationSec } =
      yield* processLines(allLines, 0);

    const combinedWav = yield* concatenateWavs(wavBuffers).mapErr((e): PipelineError => e);

    const date = extractDateFromKey(scriptKey);
    const outputWavKey = storage.buildOutputKey(date, script.title);

    yield* storage.uploadWav(outputWavKey, combinedWav).mapErr(
      (e): PipelineError => e,
    );

    const enrichedScript = rebuildEnrichedScript(script, enrichedLines, outputWavKey, totalDurationSec);

    yield* storage.uploadEnrichedScript(enrichedScript).mapErr(
      (e): PipelineError => e,
    );

    return ok(enrichedScript);
  });

type LineResult = {
  readonly enrichedLine: EnrichedLine;
  readonly wavBuffer: ArrayBuffer;
  readonly nextOffset: number;
};

const processLine = (
  line: Line,
  offsetSec: number,
): ResultAsync<LineResult, PipelineError> =>
  safeTry(async function* () {
    const speakerId = getSpeakerId(line.speaker);
    const query = yield* audioQuery(line.text, speakerId).mapErr(
      (e): PipelineError => e,
    );
    const wavBuffer = yield* synthesis(speakerId, query).mapErr(
      (e): PipelineError => e,
    );
    const durationSec = yield* getWavDurationSec(wavBuffer).mapErr((e): PipelineError => e);
    return ok({
      enrichedLine: {
        speaker: line.speaker,
        text: line.text,
        voicevoxSpeakerId: speakerId,
        offsetSec,
        durationSec,
      },
      wavBuffer,
      nextOffset: offsetSec + durationSec,
    });
  });

type LinesAccumulator = {
  readonly enrichedLines: readonly EnrichedLine[];
  readonly wavBuffers: readonly ArrayBuffer[];
  readonly offsetSec: number;
};

const processLines = (
  lines: readonly Line[],
  initialOffset: number,
): ResultAsync<LinesAccumulator, PipelineError> =>
  lines.reduce(
    (accAsync: ResultAsync<LinesAccumulator, PipelineError>, line) =>
      accAsync.andThen((acc) =>
        processLine(line, acc.offsetSec).map(
          ({ enrichedLine, wavBuffer, nextOffset }) => ({
            enrichedLines: [...acc.enrichedLines, enrichedLine],
            wavBuffers: [...acc.wavBuffers, wavBuffer],
            offsetSec: nextOffset,
          }),
        ),
      ),
    okAsync<LinesAccumulator, PipelineError>({
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
  const { taken: b0Lines, next: s1 } = takeLines(state, disc.blocks[0].lines.length);
  const { taken: b1Lines, next: s2 } = takeLines(s1, disc.blocks[1].lines.length);
  const { taken: b2Lines, next: s3 } = takeLines(s2, disc.blocks[2].lines.length);
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
  const { taken: newsOverview, next: s2 } = takeLines(s1, intro.newsOverview.length);

  const { b0Lines: d1b0Lines, b1Lines: d1b1Lines, b2Lines: d1b2Lines, next: s3 } =
    takeDiscussionBlocks(s2, disc1);
  const { b0Lines: d2b0Lines, b1Lines: d2b1Lines, b2Lines: d2b2Lines, next: s4 } =
    takeDiscussionBlocks(s3, disc2);
  const { b0Lines: d3b0Lines, b1Lines: d3b1Lines, b2Lines: d3b2Lines, next: s5 } =
    takeDiscussionBlocks(s4, disc3);

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
