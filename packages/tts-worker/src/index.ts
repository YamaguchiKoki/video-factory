import { err, ok, safeTry } from "neverthrow";
import { z } from "zod";
import type { EnrichedScript } from "./schema.js";
import { runPipeline, type PipelineError } from "./pipeline.js";
import { buildOutputWavKey, getScriptFromS3, uploadWavToS3 } from "./s3.js";
import type { StorageDeps } from "./storage.js";

const HandlerInputSchema = z.object({ scriptS3Key: z.string() });

type HandlerError =
  | { readonly type: "INPUT_VALIDATION_ERROR"; readonly message: string }
  | { readonly type: "CONFIG_ERROR"; readonly message: string }
  | PipelineError;

const createS3Storage = (bucket: string): StorageDeps => ({
  getScript: (key) => getScriptFromS3(bucket, key),
  uploadWav: (key, data) => uploadWavToS3(bucket, key, data),
  buildOutputKey: buildOutputWavKey,
});

export const handler = async (event: unknown): Promise<EnrichedScript> => {
  const result = await safeTry(async function* () {
    const inputParse = HandlerInputSchema.safeParse(event);
    if (!inputParse.success) {
      return err<EnrichedScript, HandlerError>({
        type: "INPUT_VALIDATION_ERROR",
        message: inputParse.error.message,
      });
    }
    const { scriptS3Key } = inputParse.data;

    const s3Bucket = process.env["S3_BUCKET"];
    if (!s3Bucket) {
      return err<EnrichedScript, HandlerError>({
        type: "CONFIG_ERROR",
        message: "S3_BUCKET environment variable is not set",
      });
    }

    const storage = createS3Storage(s3Bucket);
    const enriched = yield* runPipeline(storage, scriptS3Key).mapErr(
      (e): HandlerError => e,
    );
    return ok<EnrichedScript, HandlerError>(enriched);
  });

  return result.match(
    (enriched) => enriched,
    (error) => {
      throw new Error(`[${error.type}] ${error.message}`);
    },
  );
};
