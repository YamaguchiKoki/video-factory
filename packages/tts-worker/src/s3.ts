import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createS3ClientConfig, type S3EnvConfig } from "@video-factory/shared";
import { Effect, Layer, Schema } from "effect";
import {
  S3GetObjectError,
  S3PutObjectError,
  S3ValidationError,
} from "./errors.js";
import { type EnrichedScript, Script } from "./schema.js";
import { StorageService } from "./storage.js";

export type { S3EnvConfig } from "@video-factory/shared";
export { createS3ClientConfig } from "@video-factory/shared";

export const extractDateFromKey = (key: string): string => {
  const filename = key.split("/").at(-1) ?? key;
  return filename.replace(".json", "");
};

export const createStorageServiceLive = (
  bucket: string,
  outputWavKey: string,
  outputScriptKey: string,
  envConfig: S3EnvConfig = {},
) => {
  const s3 = new S3Client(createS3ClientConfig(envConfig));

  const getScript = (key: string) =>
    Effect.tryPromise({
      try: () => s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
      catch: (e) =>
        new S3GetObjectError({
          message: e instanceof Error ? e.message : String(e),
          cause: e,
        }),
    }).pipe(
      Effect.flatMap((response) => {
        if (!response.Body) {
          return Effect.fail(
            new S3GetObjectError({ message: "S3 response body is empty" }),
          );
        }
        const body = response.Body;
        return Effect.tryPromise({
          try: () => body.transformToString(),
          catch: (e) =>
            new S3GetObjectError({
              message: e instanceof Error ? e.message : String(e),
              cause: e,
            }),
        });
      }),
      Effect.flatMap((jsonStr) =>
        Effect.try({
          try: () => JSON.parse(jsonStr) as unknown,
          catch: (e) =>
            new S3ValidationError({
              message: e instanceof Error ? e.message : String(e),
              cause: e,
            }),
        }),
      ),
      Effect.flatMap((raw) =>
        Schema.decodeUnknownEffect(Script)(raw).pipe(
          Effect.mapError(
            (e) =>
              new S3ValidationError({
                message: String(e),
              }),
          ),
        ),
      ),
    );

  const uploadWav = (key: string, data: ArrayBuffer) =>
    Effect.tryPromise({
      try: () =>
        s3
          .send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: Buffer.from(data),
              ContentType: "audio/wav",
            }),
          )
          .then(() => undefined),
      catch: (e) =>
        new S3PutObjectError({
          message: e instanceof Error ? e.message : String(e),
          cause: e,
        }),
    });

  const uploadEnrichedScript = (data: EnrichedScript) =>
    Effect.tryPromise({
      try: () =>
        s3
          .send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: outputScriptKey,
              Body: Buffer.from(JSON.stringify(data)),
              ContentType: "application/json",
            }),
          )
          .then(() => undefined),
      catch: (e) =>
        new S3PutObjectError({
          message: e instanceof Error ? e.message : String(e),
          cause: e,
        }),
    });

  return Layer.succeed(StorageService, {
    getScript,
    uploadWav,
    uploadEnrichedScript,
    buildOutputKey: (_date: string, _title: string) => outputWavKey,
  });
};
