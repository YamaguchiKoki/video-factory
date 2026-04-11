import { generateImage } from "ai";
import { Effect, Schema } from "effect";
import type { Script, ThumbnailResult } from "../schema";
import { bedrock } from "../shared/bedrock";

const IMAGE_MODEL_ID = "amazon.nova-canvas-v1:0";

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

export const generateThumbnail = (
  script: Script,
): Effect.Effect<ThumbnailResult, ThumbnailGenerationError> =>
  Effect.tryPromise({
    try: () =>
      generateImage({
        model: bedrock.imageModel(IMAGE_MODEL_ID),
        prompt: buildThumbnailPrompt(script),
      }),
    catch: (e) =>
      new ThumbnailGenerationError({
        message: e instanceof Error ? e.message : String(e),
      }),
  }).pipe(
    Effect.flatMap((result) => {
      const image = result.images[0];
      if (!image) {
        return Effect.fail(
          new ThumbnailGenerationError({
            message: "No image returned from model",
          }),
        );
      }
      return Effect.succeed({
        imageBase64: image.base64,
        contentType: "image/png" as const,
      });
    }),
  );

// ============================================
// Helpers
// ============================================

const buildThumbnailPrompt = (script: Script): string => {
  const newsTitles = script.newsItems.map((item) => item.title).join(", ");
  return `Create a YouTube thumbnail for a Japanese news radio show titled "${script.title}". Topics: ${newsTitles}. Style: modern, clean, professional news broadcast design with bold Japanese typography.`;
};
