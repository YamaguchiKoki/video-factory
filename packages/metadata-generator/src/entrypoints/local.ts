import fs from "node:fs/promises";
import path from "node:path";
import {
  parseWithZodEffect,
  type Script,
  ScriptSchema,
} from "@video-factory/shared";
import { Effect } from "effect";
import { createMastraInstance } from "../mastra/instance-factory";
import { generateMetadata } from "../pipeline/generate-metadata";

const usage = (): never => {
  console.error(
    "Usage: pnpm --filter metadata-generator run local <script.json> [output-dir]",
  );
  process.exit(1);
};

const readScript = (scriptPath: string): Effect.Effect<Script, Error> =>
  Effect.tryPromise({
    try: () => fs.readFile(scriptPath, "utf-8"),
    catch: (e) =>
      new Error(
        `Failed to read ${scriptPath}: ${e instanceof Error ? e.message : String(e)}`,
      ),
  }).pipe(
    Effect.flatMap((body) =>
      Effect.try({
        try: () => JSON.parse(body) as unknown,
        catch: (e) =>
          new Error(
            `Failed to parse JSON in ${scriptPath}: ${e instanceof Error ? e.message : String(e)}`,
          ),
      }),
    ),
    Effect.flatMap((raw) =>
      parseWithZodEffect(ScriptSchema, raw).pipe(
        Effect.mapError(
          (err) =>
            new Error(
              `Schema validation failed for ${scriptPath}: ${err.message}`,
            ),
        ),
      ),
    ),
  );

const writeOutputs = (
  outputDir: string,
  thumbnailBase64: string,
  description: { text: string },
  comment: { text: string },
): Effect.Effect<
  { thumbnailPath: string; descriptionPath: string; commentPath: string },
  Error
> => {
  const thumbnailPath = path.join(outputDir, "thumbnail.png");
  const descriptionPath = path.join(outputDir, "description.json");
  const commentPath = path.join(outputDir, "comment.json");

  return Effect.tryPromise({
    try: async () => {
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(thumbnailPath, Buffer.from(thumbnailBase64, "base64"));
      await fs.writeFile(descriptionPath, JSON.stringify(description, null, 2));
      await fs.writeFile(commentPath, JSON.stringify(comment, null, 2));
      return { thumbnailPath, descriptionPath, commentPath };
    },
    catch: (e) =>
      new Error(
        `Failed to write outputs to ${outputDir}: ${e instanceof Error ? e.message : String(e)}`,
      ),
  });
};

const program = Effect.gen(function* () {
  const scriptPath = process.argv[2];
  if (!scriptPath) {
    usage();
    return;
  }
  const outputDir = path.resolve(
    process.argv[3] ??
      path.join(path.dirname(path.resolve(scriptPath)), "metadata-out"),
  );

  const absoluteScriptPath = path.resolve(scriptPath);
  console.log(`Input:    ${absoluteScriptPath}`);
  console.log(`Output:   ${outputDir}`);

  const script = yield* readScript(absoluteScriptPath);

  const mastra = createMastraInstance();
  const metadata = yield* generateMetadata(script, mastra).pipe(
    Effect.mapError((e) => new Error(e.message)),
  );

  const written = yield* writeOutputs(
    outputDir,
    metadata.thumbnail.imageBase64,
    metadata.description,
    metadata.comment,
  );

  console.log(`Thumbnail: ${written.thumbnailPath}`);
  console.log(`Description: ${written.descriptionPath}`);
  console.log(`Comment:   ${written.commentPath}`);
});

Effect.runPromise(program).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
