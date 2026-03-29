import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import {
  err,
  fromPromise,
  fromThrowable,
  ok,
  type ResultAsync,
} from "neverthrow";
import { type S3Error, toError } from "./errors.js";
import { type EnrichedScript, type Script, ScriptSchema } from "./schema.js";
import type { StorageDeps } from "./storage.js";

export type S3EnvConfig = {
  readonly S3_ENDPOINT_URL?: string;
  readonly S3_ACCESS_KEY_ID?: string;
  readonly S3_SECRET_ACCESS_KEY?: string;
};

export const createS3ClientConfig = (env: S3EnvConfig = {}): S3ClientConfig => {
  const endpointUrl = env.S3_ENDPOINT_URL;
  if (!endpointUrl) {
    return {};
  }
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  return {
    endpoint: endpointUrl,
    region: "ap-northeast-1",
    forcePathStyle: true,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  };
};

const s3 = new S3Client(createS3ClientConfig());

export const getScriptFromS3 = (
  bucket: string,
  key: string,
): ResultAsync<Script, S3Error> =>
  fromPromise(
    s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
    (e): S3Error => ({ type: "GET_OBJECT_ERROR", message: toError(e).message }),
  )
    .andThen((response) => {
      if (!response.Body) {
        return err<string, S3Error>({
          type: "GET_OBJECT_ERROR",
          message: "S3 response body is empty",
        });
      }
      return fromPromise(
        response.Body.transformToString(),
        (e): S3Error => ({
          type: "GET_OBJECT_ERROR",
          message: toError(e).message,
        }),
      );
    })
    .andThen((jsonStr) =>
      fromThrowable(
        JSON.parse,
        (e): S3Error => ({
          type: "VALIDATION_ERROR",
          message: toError(e).message,
        }),
      )(jsonStr),
    )
    .andThen((raw) => {
      const parsed = ScriptSchema.safeParse(raw);
      if (!parsed.success) {
        return err<Script, S3Error>({
          type: "VALIDATION_ERROR",
          message: parsed.error.message,
        });
      }
      return ok<Script, S3Error>(parsed.data);
    });

export const uploadWavToS3 = (
  bucket: string,
  key: string,
  data: ArrayBuffer,
): ResultAsync<void, S3Error> =>
  fromPromise(
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
    (e): S3Error => ({ type: "PUT_OBJECT_ERROR", message: toError(e).message }),
  );

export const uploadEnrichedScriptToS3 = (
  bucket: string,
  key: string,
  data: EnrichedScript,
): ResultAsync<void, S3Error> =>
  fromPromise(
    s3
      .send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: Buffer.from(JSON.stringify(data)),
          ContentType: "application/json",
        }),
      )
      .then(() => undefined),
    (e): S3Error => ({ type: "PUT_OBJECT_ERROR", message: toError(e).message }),
  );

export const extractDateFromKey = (key: string): string => {
  const filename = key.split("/").at(-1) ?? key;
  return filename.replace(".json", "");
};

export const createDockerStorage = (
  bucket: string,
  outputWavKey: string,
  outputScriptKey: string,
): StorageDeps => ({
  getScript: (key) => getScriptFromS3(bucket, key),
  uploadWav: (key, data) => uploadWavToS3(bucket, key, data),
  uploadEnrichedScript: (data) =>
    uploadEnrichedScriptToS3(bucket, outputScriptKey, data),
  buildOutputKey: (_date, _title) => outputWavKey,
});
