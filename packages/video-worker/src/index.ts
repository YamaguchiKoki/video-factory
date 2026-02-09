/**
 * Entry point for video-worker CLI
 * Handles CLI argument parsing and orchestrates video rendering workflow
 */

import { parseScript, buildRenderConfig } from "./core";
import {
  readFile,
  writeFile,
  createTempDir,
  cleanupTempDir,
  createRenderVideo,
} from "./infrastructure";
import { createRenderVideoWorkflow } from "./service/video-service";
import { createLogger, type Logger } from "./infrastructure/logger";

/**
 * CLI argument interface
 */
interface CliArgs {
  script?: string;
  audio?: string;
  output?: string;
}

/**
 * Parse CLI arguments from process.argv
 * @param argv - Process arguments array
 * @returns Parsed CLI arguments
 */
const parseCliArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = {};

  for (let i = 2; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];

    if (flag === "--script") {
      args.script = value;
    } else if (flag === "--audio") {
      args.audio = value;
    } else if (flag === "--output") {
      args.output = value;
    }
  }

  return args;
};

/**
 * Create a simple console logger
 */
const createConsoleLogger = (requestId: string): Logger => {
  return createLogger(requestId);
};

/**
 * Main entry point function
 * Executes video rendering workflow based on CLI arguments
 */
export const main = async (): Promise<void> => {
  const args = parseCliArgs(process.argv);
  const mockMode = process.env.MOCK_MODE === "true";

  // Validate required arguments (unless in mock mode)
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
  const logger = createConsoleLogger(requestId);

  // Determine actual paths (use mock data if in mock mode)
  const scriptPath = mockMode ? "mock-data/script.json" : args.script!;
  const audioPath = mockMode ? "mock-data/audio.wav" : args.audio!;
  const outputPath = args.output;

  // Create workflow with dependencies
  const renderVideo = createRenderVideo(logger);
  const renderWorkflow = createRenderVideoWorkflow({
    readFile,
    parseScript,
    buildRenderConfig,
    renderVideo,
    writeFile,
    createTempDir,
    cleanupTempDir,
    logger,
  });

  // Execute workflow
  const result = await renderWorkflow(scriptPath, audioPath, outputPath);

  // Handle result
  result.match(
    (path: string) => {
      logger.info("Video rendering successful", { outputPath: path });
      process.exit(0);
    },
    (error: { message: string; type: string; context?: Record<string, unknown> }) => {
      console.error("Error:", error.message);
      console.error("Type:", error.type);
      if (error.context) {
        console.error("Context:", JSON.stringify(error.context, null, 2));
      }
      process.exit(1);
    }
  );
};

// Run main if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
