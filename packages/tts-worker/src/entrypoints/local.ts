import path from "node:path";
import fs from "node:fs/promises";
import { runPipeline } from "../pipeline.js";
import { createLocalStorage } from "../local-storage.js";

const main = async (): Promise<void> => {
  const scriptPath = process.argv[2];
  if (!scriptPath) {
    console.error("Usage: pnpm --filter tts-worker run local <script.json>");
    process.exit(1);
  }

  const absolutePath = path.resolve(scriptPath);
  const baseDir = path.dirname(absolutePath);
  const scriptKey = path.basename(absolutePath);

  console.log(`Input:  ${absolutePath}`);

  const storage = createLocalStorage(baseDir);
  const result = await runPipeline(storage, scriptKey);

  if (result.isErr()) {
    console.error(`Error [${result.error.type}]: ${result.error.message}`);
    process.exit(1);
  }

  const enriched = result.value;
  const outputWavPath = path.resolve(baseDir, enriched.outputWavS3Key);
  const enrichedJsonPath = outputWavPath.replace(/\.wav$/, ".enriched.json");

  await fs.mkdir(path.dirname(enrichedJsonPath), { recursive: true });
  await fs.writeFile(enrichedJsonPath, JSON.stringify(enriched, null, 2));

  console.log(`WAV:    ${outputWavPath}`);
  console.log(`JSON:   ${enrichedJsonPath}`);
  console.log(`Duration: ${enriched.totalDurationSec.toFixed(1)}s`);
};

main();
