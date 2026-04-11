import { Effect } from "effect";
import {
  downloadScriptFromS3,
  uploadTextToS3,
  uploadThumbnailToS3,
} from "../infrastructure/s3";
import { createMastraInstance } from "../mastra/instance-factory";
import { generateMetadata } from "../pipeline/generate-metadata";
import type { MetadataOutput } from "../schema";
import { HandlerInputSchema } from "../schema";

const THUMBNAIL_S3_KEY = "metadata-generator/thumbnail.png";
const DESCRIPTION_S3_KEY = "metadata-generator/description.json";
const COMMENT_S3_KEY = "metadata-generator/comment.json";

export const handler = async (event: unknown): Promise<MetadataOutput> => {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("S3_BUCKET environment variable is required");
  }

  const inputResult = HandlerInputSchema.safeParse(event);
  if (!inputResult.success) {
    throw new Error(`Invalid input: ${inputResult.error.message}`);
  }
  const { scriptKey } = inputResult.data;

  const mastra = createMastraInstance();

  const pipeline = downloadScriptFromS3(bucket, scriptKey).pipe(
    Effect.flatMap((script) => generateMetadata(script, mastra)),
    Effect.flatMap((metadata) =>
      Effect.all([
        uploadThumbnailToS3(
          bucket,
          THUMBNAIL_S3_KEY,
          Buffer.from(metadata.thumbnail.imageBase64, "base64"),
        ),
        uploadTextToS3(
          bucket,
          DESCRIPTION_S3_KEY,
          JSON.stringify(metadata.description),
        ),
        uploadTextToS3(
          bucket,
          COMMENT_S3_KEY,
          JSON.stringify(metadata.comment),
        ),
      ]).pipe(Effect.map(() => metadata)),
    ),
    Effect.mapError((e) => new Error(e.message)),
  );

  return Effect.runPromise(pipeline);
};
