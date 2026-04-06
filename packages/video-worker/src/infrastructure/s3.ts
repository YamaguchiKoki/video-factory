import { readFile, writeFile } from "node:fs/promises";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  createS3ClientConfig,
  type S3EnvConfig,
  toMessage,
} from "@video-factory/shared";
import { Effect } from "effect";
import { S3DownloadError, S3UploadError } from "../core/errors";

export type { S3EnvConfig } from "@video-factory/shared";
export { createS3ClientConfig } from "@video-factory/shared";

export const createS3Client = (env: S3EnvConfig = {}): S3Client =>
  new S3Client(createS3ClientConfig(env));

export const downloadToFile = (
  client: S3Client,
  bucket: string,
  key: string,
  localPath: string,
): Effect.Effect<void, S3DownloadError> =>
  Effect.tryPromise({
    try: () => client.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
    catch: (e) => new S3DownloadError({ message: toMessage(e), cause: e }),
  }).pipe(
    Effect.flatMap((response) => {
      if (!response.Body) {
        return Effect.fail(
          new S3DownloadError({ message: "S3 response body is empty" }),
        );
      }
      const body = response.Body;
      return Effect.tryPromise({
        try: () =>
          body
            .transformToByteArray()
            .then((bytes) => writeFile(localPath, bytes)),
        catch: (e) => new S3DownloadError({ message: toMessage(e), cause: e }),
      });
    }),
  );

export const uploadFromFile = (
  client: S3Client,
  bucket: string,
  key: string,
  localPath: string,
  contentType: string,
): Effect.Effect<void, S3UploadError> =>
  Effect.tryPromise({
    try: () => readFile(localPath),
    catch: (e) => new S3UploadError({ message: toMessage(e), cause: e }),
  }).pipe(
    Effect.flatMap((body) =>
      Effect.tryPromise({
        try: () =>
          client
            .send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
              }),
            )
            .then(() => undefined),
        catch: (e) => new S3UploadError({ message: toMessage(e), cause: e }),
      }),
    ),
  );
