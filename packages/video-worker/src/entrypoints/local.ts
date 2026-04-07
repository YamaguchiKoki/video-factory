import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { createLocalDeps } from "../deps";
import { createRenderVideoWorkflow } from "../service/video-service";

const isTaggedError = (e: unknown): e is { _tag: string } =>
  e !== null &&
  typeof e === "object" &&
  "_tag" in e &&
  typeof (e as Record<string, unknown>)._tag === "string";

const __filename = fileURLToPath(import.meta.url);

const parseArgs = (): { script?: string; audio?: string; output?: string } => {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };
  return {
    script: getArg("--script"),
    audio: getArg("--audio"),
    output: getArg("--output"),
  };
};

export const main = async (): Promise<void> => {
  const opts = parseArgs();

  if (!opts.script || !opts.audio || !opts.output) {
    console.error("Error: --script, --audio, and --output are all required");
    process.exit(1);
    return;
  }

  const deps = createLocalDeps({ requestId: crypto.randomUUID() });
  const renderWorkflow = createRenderVideoWorkflow(deps);
  const program = renderWorkflow(opts.script, opts.audio, opts.output);

  await Effect.runPromise(program).then(
    (outputFilePath) => {
      deps.logger.info("Video rendering successful", {
        outputPath: outputFilePath,
      });
    },
    (error: unknown) => {
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error),
      );
      if (isTaggedError(error)) {
        console.error("Type:", error._tag);
      }
      process.exit(1);
    },
  );
};

if (process.argv[1] === __filename) {
  main().catch((error: unknown) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
