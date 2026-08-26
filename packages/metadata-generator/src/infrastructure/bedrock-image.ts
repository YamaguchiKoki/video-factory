import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { Effect, Result, Schema } from "effect";
import { z } from "zod";

// amazon.nova-canvas-v1:0 は Bedrock 上で LEGACY となり呼び出せなくなった。
// us-east-1 に ACTIVE な text-to-image モデルは存在しないため us-west-2 を使う。
// @ai-sdk/amazon-bedrock の imageModel() は Nova Canvas 専用のボディを組み立てる
// 実装なので Stability 系には使えず、InvokeModel を直接呼んでいる。
const IMAGE_MODEL_ID = "stability.stable-image-core-v1:1";
const IMAGE_REGION = "us-west-2";

// ============================================
// Error type
// ============================================

export class BedrockImageError extends Schema.TaggedErrorClass<BedrockImageError>()(
  "BedrockImageError",
  { message: Schema.String },
) {}

// ============================================
// Public functions
// ============================================

export const createBedrockImageClient = (): BedrockRuntimeClient =>
  new BedrockRuntimeClient({ region: IMAGE_REGION });

export const generateBackgroundImage =
  (client: BedrockRuntimeClient) =>
  (prompt: string): Effect.Effect<string, BedrockImageError> =>
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: (signal) =>
          client.send(
            new InvokeModelCommand({
              modelId: IMAGE_MODEL_ID,
              contentType: "application/json",
              accept: "application/json",
              body: new TextEncoder().encode(
                JSON.stringify({
                  prompt,
                  mode: "text-to-image",
                  aspect_ratio: "16:9",
                  output_format: "png",
                }),
              ),
            }),
            { abortSignal: signal },
          ),
        catch: (e) =>
          new BedrockImageError({
            message: e instanceof Error ? e.message : String(e),
          }),
      });

      const decoded = yield* decodeBody(response.body);

      const parsed = ResponseSchema.safeParse(decoded);
      if (!parsed.success) {
        return yield* Effect.fail(
          new BedrockImageError({
            message: `Unexpected Bedrock image response: ${parsed.error.message}`,
          }),
        );
      }

      const reason = parsed.data.finish_reasons[0];
      if (reason != null) {
        return yield* Effect.fail(
          new BedrockImageError({
            message: `Image generation was rejected: ${reason}`,
          }),
        );
      }

      const image = parsed.data.images[0];
      if (!image) {
        return yield* Effect.fail(
          new BedrockImageError({ message: "No image returned from model" }),
        );
      }

      return image;
    });

// ============================================
// Helpers
// ============================================

const ResponseSchema = z.object({
  images: z.array(z.string()),
  finish_reasons: z.array(z.string().nullable()),
});

const decodeBody = (
  body: Uint8Array | undefined,
): Effect.Effect<unknown, BedrockImageError> => {
  if (!body) {
    return Effect.fail(
      new BedrockImageError({ message: "Empty response body" }),
    );
  }

  const parsed = Result.try({
    try: () => JSON.parse(new TextDecoder().decode(body)) as unknown,
    catch: (e) =>
      new BedrockImageError({
        message: `Failed to decode response body: ${String(e)}`,
      }),
  });

  return Result.isSuccess(parsed)
    ? Effect.succeed(parsed.success)
    : Effect.fail(parsed.failure);
};
