import { Command } from "commander";
import { fromPromise } from "neverthrow";
import { fileURLToPath } from "url";
import { createRenderVideoWorkflow } from "../service/video-service";
import { createLocalDeps } from "../deps";

const __filename = fileURLToPath(import.meta.url);

export const main = async (): Promise<void> => {
  const program = new Command()
    .option("--script <path>", "Path to the script JSON file")
    .option("--audio <path>", "Path to the audio WAV file")
    .option("--output <path>", "Path for the output video");

  program.parse(process.argv);
  const opts = program.opts<{ script?: string; audio?: string; output?: string }>();

  if (!opts.script || !opts.audio || !opts.output) {
    console.error("Error: --script, --audio, and --output are all required");
    process.exit(1);
  }

  const deps = createLocalDeps({ requestId: crypto.randomUUID() });
  const renderWorkflow = createRenderVideoWorkflow(deps);
  const result = await renderWorkflow(opts.script, opts.audio, opts.output);

  result.match(
    (outputFilePath) => {
      deps.logger.info("Video rendering successful", { outputPath: outputFilePath });
    },
    (error) => {
      console.error("Error:", error.message);
      console.error("Type:", error.type);
      if (error.context) {
        console.error("Context:", JSON.stringify(error.context, null, 2));
      }
      process.exit(1);
    },
  );
};

if (process.argv[1] === __filename) {
  fromPromise(main(), (error) => {
    console.error("Unhandled error:", error);
    return error;
  }).mapErr(() => process.exit(1));
}
