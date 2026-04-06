import fs from "node:fs/promises";
import path from "node:path";
import { Effect, Layer } from "effect";
import { createLocalStorageLayer } from "../local-storage.js";
import { runPipeline } from "../pipeline.js";
import { VoicevoxServiceLive } from "../voicevox.js";

const program = Effect.gen(function* () {
  const scriptPath = process.argv[2];
  if (!scriptPath) {
    console.error("Usage: pnpm --filter tts-worker run local <script.json>");
    process.exit(1);
    return;
  }

  const absolutePath = path.resolve(scriptPath);
  const baseDir = path.dirname(absolutePath);
  const scriptKey = path.basename(absolutePath);

  console.log(`Input:  ${absolutePath}`);

  const enriched = yield* runPipeline(scriptKey).pipe(
    Effect.provide(
      Layer.merge(createLocalStorageLayer(baseDir), VoicevoxServiceLive),
    ),
  );

  const outputWavPath = path.resolve(baseDir, enriched.outputWavS3Key);
  const enrichedJsonPath = outputWavPath.replace(/\.wav$/, ".enriched.json");

  yield* Effect.tryPromise({
    try: async () => {
      await fs.mkdir(path.dirname(enrichedJsonPath), { recursive: true });
      await fs.writeFile(enrichedJsonPath, JSON.stringify(enriched, null, 2));
    },
    catch: (e) => e,
  });

  console.log(`WAV:    ${outputWavPath}`);
  console.log(`JSON:   ${enrichedJsonPath}`);
  console.log(`Duration: ${enriched.totalDurationSec.toFixed(1)}s`);
});

Effect.runPromise(program).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
