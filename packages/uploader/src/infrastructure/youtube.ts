import { Readable } from "node:stream";
import { Effect, Schema } from "effect";
import type { google } from "googleapis";
import type { PrivacyStatus, UploadPayload, UploadResult } from "../schema";

export class YouTubeUploadError extends Schema.TaggedErrorClass<YouTubeUploadError>()(
  "YouTubeUploadError",
  { message: Schema.String },
) {}

type YouTubeClient = ReturnType<typeof google.youtube>;

/**
 * 動画・サムネイル・初コメントを YouTube に送る。
 *
 * 動画のアップロードが成功した時点で「やり直せない」状態になる。
 * videos.insert は 1 回 1600 クォータユニット（1日の既定枠は 10000）を
 * 消費するうえ、再実行すると同じ動画が二重に上がる。そのため
 * サムネイルとコメントの失敗では全体を失敗させず、結果に成否を載せて返す。
 * 呼び出し側は videoId を受け取れるので、後から手で直せる。
 */
export const uploadToYouTube =
  (client: YouTubeClient) =>
  (
    payload: UploadPayload,
    privacyStatus: PrivacyStatus,
  ): Effect.Effect<UploadResult, YouTubeUploadError> =>
    Effect.gen(function* () {
      const videoId = yield* insertVideo(client, payload, privacyStatus);

      // ここから先は失敗しても動画は残る。個別に成否を記録する。
      const thumbnailSet = yield* attempt(
        setThumbnail(client, videoId, payload.thumbnail),
        `[youtube] thumbnail upload failed for ${videoId}`,
      );
      const commentPosted = yield* attempt(
        postComment(client, videoId, payload.firstComment),
        `[youtube] first comment failed for ${videoId}`,
      );

      return {
        videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        privacyStatus,
        thumbnailSet,
        commentPosted,
      };
    });

// ============================================
// Helpers
// ============================================

const insertVideo = (
  client: YouTubeClient,
  payload: UploadPayload,
  privacyStatus: PrivacyStatus,
): Effect.Effect<string, YouTubeUploadError> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        client.videos.insert({
          part: ["snippet", "status"],
          requestBody: {
            snippet: {
              title: payload.title,
              description: payload.description,
            },
            status: { privacyStatus },
          },
          media: { body: Readable.from(Buffer.from(payload.video)) },
        }),
      catch: (e) => toError("videos.insert", e),
    });

    const videoId = response.data.id;
    if (!videoId) {
      return yield* Effect.fail(
        new YouTubeUploadError({
          message: "videos.insert succeeded but returned no video id",
        }),
      );
    }
    return videoId;
  });

const setThumbnail = (
  client: YouTubeClient,
  videoId: string,
  thumbnail: Uint8Array,
): Effect.Effect<void, YouTubeUploadError> =>
  Effect.tryPromise({
    try: async () => {
      await client.thumbnails.set({
        videoId,
        media: { body: Readable.from(Buffer.from(thumbnail)) },
      });
    },
    catch: (e) => toError("thumbnails.set", e),
  });

const postComment = (
  client: YouTubeClient,
  videoId: string,
  text: string,
): Effect.Effect<void, YouTubeUploadError> =>
  Effect.tryPromise({
    try: async () => {
      await client.commentThreads.insert({
        part: ["snippet"],
        requestBody: {
          snippet: {
            videoId,
            topLevelComment: { snippet: { textOriginal: text } },
          },
        },
      });
    },
    catch: (e) => toError("commentThreads.insert", e),
  });

/** 失敗しても止めず、成否を boolean で返す。理由は警告として残す。 */
const attempt = (
  effect: Effect.Effect<void, YouTubeUploadError>,
  warning: string,
): Effect.Effect<boolean, never> =>
  effect.pipe(
    Effect.as(true),
    Effect.catch((e) =>
      Effect.sync(() => {
        console.warn(`${warning}: ${e.message}`);
        return false;
      }),
    ),
  );

const toError = (operation: string, e: unknown): YouTubeUploadError =>
  new YouTubeUploadError({
    message: `${operation} failed: ${e instanceof Error ? e.message : String(e)}`,
  });
