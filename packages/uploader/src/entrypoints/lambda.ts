import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Effect } from "effect";
import { google } from "googleapis";
import { loadCredentials } from "../infrastructure/credentials";
import { downloadObject } from "../infrastructure/s3";
import { uploadToYouTube } from "../infrastructure/youtube";
import { collectPayload } from "../pipeline/collect";
import { PrivacyStatusSchema, type UploadResult } from "../schema";

const s3 = new S3Client({});
const secrets = new SecretsManagerClient({});

export const handler = async (): Promise<UploadResult> => {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET environment variable is required");

  const secretArn = process.env.YOUTUBE_SECRET_ARN;
  if (!secretArn)
    throw new Error("YOUTUBE_SECRET_ARN environment variable is required");

  // 既定は private。API 経由のアップロードはチャンネル未確認だと
  // どのみち非公開になるうえ、AI 生成物を無確認で公開しないための保険でもある。
  const privacyParsed = PrivacyStatusSchema.safeParse(
    process.env.YOUTUBE_PRIVACY_STATUS ?? "private",
  );
  if (!privacyParsed.success) {
    throw new Error(
      `YOUTUBE_PRIVACY_STATUS must be one of private/unlisted/public, got "${process.env.YOUTUBE_PRIVACY_STATUS}"`,
    );
  }

  const program = Effect.gen(function* () {
    const credentials = yield* loadCredentials(secrets)(secretArn);
    const payload = yield* collectPayload(downloadObject(s3))(bucket);

    const auth = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret,
    );
    auth.setCredentials({ refresh_token: credentials.refreshToken });
    const client = google.youtube({ version: "v3", auth });

    return yield* uploadToYouTube(client)(payload, privacyParsed.data);
  }).pipe(Effect.mapError((e) => new Error(e.message)));

  const result = await Effect.runPromise(program);

  console.log(
    `[uploader] uploaded ${result.videoUrl} (${result.privacyStatus}) ` +
      `thumbnail=${result.thumbnailSet} comment=${result.commentPosted}`,
  );

  return result;
};
