import { Effect, Result, Schema } from "effect";
import { z } from "zod";
import type { UploadPayload } from "../schema";

// 他のステップと同じ固定キー。日付は入らないため毎日上書きされる。
export const SCRIPT_KEY = "script-generator/script.json";
export const DESCRIPTION_KEY = "metadata-generator/description.json";
export const COMMENT_KEY = "metadata-generator/comment.json";
export const THUMBNAIL_KEY = "metadata-generator/thumbnail.png";
export const VIDEO_KEY = "video-worker/video.mp4";

export class PayloadCollectionError extends Schema.TaggedErrorClass<PayloadCollectionError>()(
  "PayloadCollectionError",
  { message: Schema.String },
) {}

type Download = (
  bucket: string,
  key: string,
) => Effect.Effect<Uint8Array, { readonly message: string }>;

// タイトルだけ取れればよいので最小限。他の項目は検証しない。
const TitleSchema = z.object({ title: z.string().min(1) });
const TextSchema = z.object({ text: z.string() });

/**
 * アップロードに必要な5点を S3 から集める。
 * どれか1つでも欠けると動画を上げても中途半端になるため、全部揃って初めて成功とする。
 */
export const collectPayload =
  (download: Download) =>
  (bucket: string): Effect.Effect<UploadPayload, PayloadCollectionError> =>
    Effect.gen(function* () {
      const get = (key: string) =>
        download(bucket, key).pipe(
          Effect.mapError(
            (e) =>
              new PayloadCollectionError({
                message: `${key}: ${e.message}`,
              }),
          ),
        );

      const [scriptBytes, descriptionBytes, commentBytes, thumbnail, video] =
        yield* Effect.all(
          [
            get(SCRIPT_KEY),
            get(DESCRIPTION_KEY),
            get(COMMENT_KEY),
            get(THUMBNAIL_KEY),
            get(VIDEO_KEY),
          ],
          { concurrency: 5 },
        );

      const script = yield* parseJson(TitleSchema, scriptBytes, SCRIPT_KEY);
      const description = yield* parseJson(
        TextSchema,
        descriptionBytes,
        DESCRIPTION_KEY,
      );
      const comment = yield* parseJson(TextSchema, commentBytes, COMMENT_KEY);

      return {
        title: script.title,
        description: description.text,
        firstComment: comment.text,
        video,
        thumbnail,
      };
    });

// ============================================
// Helpers
// ============================================

const parseJson = <T>(
  schema: z.ZodType<T>,
  bytes: Uint8Array,
  key: string,
): Effect.Effect<T, PayloadCollectionError> => {
  const decoded = Result.try({
    try: () => JSON.parse(new TextDecoder().decode(bytes)) as unknown,
    catch: (e) =>
      new PayloadCollectionError({
        message: `${key}: not valid JSON (${String(e)})`,
      }),
  });
  if (Result.isFailure(decoded)) return Effect.fail(decoded.failure);

  const parsed = schema.safeParse(decoded.success);
  if (!parsed.success) {
    return Effect.fail(
      new PayloadCollectionError({
        message: `${key}: ${parsed.error.message}`,
      }),
    );
  }
  return Effect.succeed(parsed.data);
};
