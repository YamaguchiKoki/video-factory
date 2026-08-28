import { Effect, Schema } from "effect";
import {
  createBedrockImageClient,
  generateBackgroundImage,
} from "../../infrastructure/bedrock-image";
import type { Script, ThumbnailResult } from "../../schema";
import { buildBackgroundPrompt } from "./background";
import { composeThumbnail } from "./compose";

// ============================================
// Error type
// ============================================

export class ThumbnailGenerationError extends Schema.TaggedErrorClass<ThumbnailGenerationError>()(
  "ThumbnailGenerationError",
  { message: Schema.String },
) {}

// ============================================
// Public function
// ============================================

const client = createBedrockImageClient();

export const generateThumbnail = (
  script: Script,
): Effect.Effect<ThumbnailResult, ThumbnailGenerationError> =>
  Effect.gen(function* () {
    const background = yield* generateBackgroundImage(client)(
      buildBackgroundPrompt(),
    ).pipe(
      Effect.mapError(
        (e) =>
          new ThumbnailGenerationError({
            message: `Background generation failed: ${e.message}`,
          }),
      ),
    );

    const png = yield* Effect.tryPromise({
      try: () =>
        composeThumbnail({
          background: Buffer.from(background, "base64"),
          title: script.title,
          date: formatJstDate(new Date()),
        }),
      catch: (e) =>
        new ThumbnailGenerationError({
          message: `Thumbnail composition failed: ${e instanceof Error ? e.message : String(e)}`,
        }),
    });

    return {
      imageBase64: png.toString("base64"),
      contentType: "image/png" as const,
    };
  });

// ============================================
// Helpers
// ============================================

// Script に日付フィールドが無いため、Lambda の実行時刻を JST で使う。
const formatJstDate = (now: Date): string =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
