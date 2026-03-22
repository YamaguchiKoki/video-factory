import path from "path";
import { fileURLToPath } from "url";
import { parseEnrichedScript } from "./core/enriched-parser";
import {
  readFile,
  writeFile,
  createTempDir,
  cleanupTempDir,
  createRenderVideo,
  bundleComposition,
} from "./infrastructure";
import { createRenderVideoWorkflow } from "./service/video-service";
import { createLogger } from "./infrastructure/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CliArgs {
  script?: string;
  audio?: string;
  output?: string;
}

const parseCliArgs = (argv: string[]): CliArgs =>
  argv.slice(2).reduce<CliArgs>((acc, _, idx, arr) => {
    if (idx % 2 !== 0) return acc;
    const flag = arr[idx];
    const value = arr[idx + 1];
    if (flag === "--script") return { ...acc, script: value };
    if (flag === "--audio") return { ...acc, audio: value };
    if (flag === "--output") return { ...acc, output: value };
    return acc;
  }, {});

export const main = async (): Promise<void> => {
  const args = parseCliArgs(process.argv);
  const mockMode = process.env.MOCK_MODE === "true";

  if (!mockMode && (!args.script || !args.audio || !args.output)) {
    console.error("Error: Missing required arguments");
    console.error("Usage: node index.js --script <path> --audio <path> --output <path>");
    console.error("Or set MOCK_MODE=true to use mock data");
    process.exit(1);
  }

  if (!args.output) {
    console.error("Error: --output argument is required");
    process.exit(1);
  }

  const requestId = crypto.randomUUID();
  const logger = createLogger(requestId);

  const scriptPath = mockMode ? "public/script.json" : args.script!;
  const audioPath = mockMode ? "public/audio.wav" : args.audio!;
  const outputPath = args.output;

  const entryPoint = path.resolve(__dirname, "remotion/index.ts");

  const renderVideo = createRenderVideo(logger);
  const renderWorkflow = createRenderVideoWorkflow({
    readFile,
    parseEnrichedScript,
    bundleComposition,
    renderVideo,
    writeFile,
    createTempDir,
    cleanupTempDir,
    logger,
    entryPoint,
  });

  const result = await renderWorkflow(scriptPath, audioPath, outputPath);

  result.match(
    (outputFilePath: string) => {
      logger.info("Video rendering successful", { outputPath: outputFilePath });
      process.exit(0);
    },
    (error: { message: string; type: string; context?: Record<string, unknown> }) => {
      console.error("Error:", error.message);
      console.error("Type:", error.type);
      if (error.context) {
        console.error("Context:", JSON.stringify(error.context, null, 2));
      }
      process.exit(1);
    },
  );
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
