import { z } from "zod";

/**
 * Secrets Manager に入れる YouTube の認証情報。
 *
 * 取得手順:
 * 1. Google Cloud で YouTube Data API v3 を有効化
 * 2. OAuth クライアント（デスクトップアプリ）を作成して clientId / clientSecret を取得
 * 3. スコープ `https://www.googleapis.com/auth/youtube.upload` と
 *    `https://www.googleapis.com/auth/youtube.force-ssl` で一度だけ同意フローを通し、
 *    refreshToken を取得する（force-ssl はコメント投稿に必要）
 *
 * 未検証アプリのままだと refreshToken は7日で失効するため、日次運用するなら
 * OAuth 同意画面の検証を通す必要がある。
 */
export const YouTubeCredentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  refreshToken: z.string().min(1),
});
export type YouTubeCredentials = z.infer<typeof YouTubeCredentialsSchema>;

/** API 経由のアップロードはチャンネル未確認だと強制的に非公開になる。既定も private。 */
export const PrivacyStatusSchema = z.enum(["private", "unlisted", "public"]);
export type PrivacyStatus = z.infer<typeof PrivacyStatusSchema>;

/**
 * アップロードに必要な素材一式。S3 から集めてくる。
 *
 * バイト列は zod スキーマにせず型で表す。`z.instanceof(Uint8Array)` は
 * `Uint8Array<ArrayBuffer>` に狭まり、AWS SDK が返す
 * `Uint8Array<ArrayBufferLike>` を受け付けないため。
 */
export type UploadPayload = {
  readonly title: string;
  readonly description: string;
  readonly firstComment: string;
  readonly video: Uint8Array;
  readonly thumbnail: Uint8Array;
};

export const UploadResultSchema = z.object({
  videoId: z.string(),
  videoUrl: z.string(),
  privacyStatus: PrivacyStatusSchema,
  thumbnailSet: z.boolean(),
  commentPosted: z.boolean(),
});
export type UploadResult = z.infer<typeof UploadResultSchema>;
